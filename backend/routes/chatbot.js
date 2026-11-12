const express = require('express');
const router = express.Router();
const axios = require('axios');

const { ChatbotKnowledgeMatcher } = require('../services/ChatbotKnowledgeBase');

// ─── Init ─────────────────────────────────────────────────────────────────────
let knowledgeMatcher;
const initKB = () => {
  try {
    knowledgeMatcher = new ChatbotKnowledgeMatcher();
    console.log('✅ Chatbot Knowledge Base initialised');
    return true;
  } catch (e) {
    console.error('❌ KB init failed:', e);
    return false;
  }
};
initKB();

const GROQ_API_BASE = process.env.GROQ_API_BASE || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_TIMEOUT_MS = 15000;
const KB_CONFIDENCE_THRESHOLD = 0.55;
const MAX_SESSIONS = 200;

// In-memory sessions
const sessions = new Map();

// ─── Navigation Tool Definitions ──────────────────────────────────────────────
const NAV_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'navigate_to_page',
      description:
        'Navigate the user to a specific page/section of the CityZen app. ' +
        'Call this when the user asks how to reach a feature, or says they want to go somewhere.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: ['feed', 'dashboard', 'submit', 'map', 'reports', 'chatbot', 'feedback', 'transparency'],
            description: 'The target page slug',
          },
          reason: {
            type: 'string',
            description: 'Brief explanation shown to the user before navigating',
          },
        },
        required: ['page', 'reason'],
      },
    },
  },
];

const PAGE_LABELS = {
  feed:         'Complaint Feed',
  dashboard:    'Dashboard',
  submit:       'Submit Complaint',
  map:          'Complaint Map',
  reports:      'Personal Reports',
  chatbot:      'AI Assistant',
  feedback:     'Feedback',
  transparency: 'Transparency',
};

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI assistant embedded in **CityZen**, a civic complaint-management platform.
Your job is to help citizens report issues (potholes, broken streetlights, sewage, etc.), navigate the app, and understand how their complaints are processed.

Pages available in the app:
- **feed** – Complaint Feed (Instagram-style view of nearby civic issues)
- **dashboard** – Citizen Dashboard (your stats, recent activity)
- **submit** – Submit a Complaint (report a new civic issue with AI image validation)
- **map** – Complaint Map (live heat-map of all complaints)
- **reports** – Personal Reports (track your own submissions)
- **chatbot** – AI Assistant (this page)
- **feedback** – Feedback (rate the app experience)
- **transparency** – Transparency Dashboard (public accountability metrics)

When the user asks to go somewhere, or asks how to reach a feature, use the **navigate_to_page** tool.
Always respond in a helpful, concise, friendly tone. Use markdown formatting (bold, bullet points) where it helps.
Keep responses short unless the user asks for more detail. Never make up data.`;

// ─── GROQ call with tool support ─────────────────────────────────────────────
async function createGroqChatCompletion(payload) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ client not initialised — check GROQ_API_KEY');

  const response = await axios.post(
    `${GROQ_API_BASE}/chat/completions`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: GROQ_TIMEOUT_MS,
    }
  );
  return response.data;
}

async function callGroq(userMessage, history = []) {
  const sanitizedHistory = Array.isArray(history)
    ? history
        .filter(m => m && typeof m.text === 'string' && m.text.trim().length > 0)
        .map(m => ({ role: m.type === 'bot' ? 'assistant' : 'user', content: m.text }))
    : [];

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...sanitizedHistory,
    { role: 'user', content: userMessage },
  ];

  const response = await createGroqChatCompletion({
    model: GROQ_MODEL,
    messages,
    tools: NAV_TOOLS,
    tool_choice: 'auto',
    temperature: 0.6,
    max_tokens: 1024,
  });

  const msg = response?.choices?.[0]?.message;
  if (!msg) throw new Error('Empty response from Groq API');

  // ── Tool call: navigation ──
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const call = msg.tool_calls[0];
    let args;
    try {
      args = JSON.parse(call.function?.arguments || '{}');
    } catch {
      throw new Error('Invalid tool call arguments from Groq API');
    }

    const isValidPage = typeof args?.page === 'string' && Object.prototype.hasOwnProperty.call(PAGE_LABELS, args.page);
    const pageName = isValidPage ? PAGE_LABELS[args.page] : null;

    const followUpMessages = [
      ...messages,
      {
        role: 'assistant',
        content: msg.content || '',
        tool_calls: msg.tool_calls,
      },
      {
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(
          isValidPage
            ? { success: true, navigatedTo: args.page }
            : { success: false, error: 'Unknown page slug' }
        ),
      },
    ];

    const followUp = await createGroqChatCompletion({
      model: GROQ_MODEL,
      messages: followUpMessages,
      temperature: 0.5,
      max_tokens: 512,
    });

    const followUpReply = followUp?.choices?.[0]?.message?.content;
    if (!followUpReply) throw new Error('Empty follow-up response from Groq API');

    return {
      reply:      followUpReply,
      action:     isValidPage ? { type: 'navigate', page: args.page, label: pageName } : null,
      source:     'groq_tool',
      confidence: 0.9,
    };
  }

  if (!msg.content) throw new Error('Empty response from Groq API');

  return {
    reply:      msg.content,
    action:     null,
    source:     'groq',
    confidence: 0.85,
  };
}

// ─── POST /api/chatbot/message ────────────────────────────────────────────────
router.post('/message', async (req, res) => {
  try {
    const { message, conversationHistory = [], userId = 'anonymous' } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const trimmedMessage = message.trim();
    const normalizedUserId = (typeof userId === 'string' && userId.trim()) ? userId.trim() : 'anonymous';

    if (!knowledgeMatcher) {
      initKB();
      if (!knowledgeMatcher) {
        return res.status(503).json({ success: false, error: 'Chatbot initialising, try again shortly' });
      }
    }

    let session = sessions.get(normalizedUserId) || { messages: [], startTime: new Date() };
    // Use client-supplied history as prior context if this in-memory session has none (e.g. after restart)
    const priorMessages = session.messages.length > 0
      ? session.messages.slice(-8)
      : (Array.isArray(conversationHistory) ? conversationHistory.slice(-8) : []);

    session.messages.push({ type: 'user', text: trimmedMessage, timestamp: new Date() });

    // ── 1. Rule-based match ──
    const match = knowledgeMatcher.findBestMatch(trimmedMessage, priorMessages);
    console.log(`🤖 KB match: category=${match.category}, confidence=${match.confidence}`);

    let reply, action = null, source, confidence;

    if (match.confidence >= KB_CONFIDENCE_THRESHOLD) {
      reply      = match.text;
      confidence = match.confidence;
      source     = 'knowledge_base';
      if (session.messages.length > 5) {
        reply += '\n\n💡 *Feel free to ask me anything else about CityZen!*';
      }
    } else {
      console.log('⚡ KB confidence low — calling GROQ');
      try {
        const groqResult = await callGroq(trimmedMessage, priorMessages);
        reply      = groqResult.reply;
        action     = groqResult.action;
        source     = groqResult.source;
        confidence = groqResult.confidence;
      } catch (groqErr) {
        console.error('❌ GROQ error:', groqErr.message);
        reply      = match.text || "I'm not sure about that. Could you rephrase your question?";
        source     = 'knowledge_base_fallback';
        confidence = match.confidence || 0.3;
      }
    }

    session.messages.push({ type: 'bot', text: reply, action, source, confidence, timestamp: new Date() });
    // Refresh insertion order for true LRU eviction
    sessions.delete(normalizedUserId);
    sessions.set(normalizedUserId, session);
    if (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value);

    const followUpSuggestions = knowledgeMatcher.getFollowUpSuggestions(match.category, trimmedMessage);

    res.json({
      success: true,
      reply,
      confidence,
      category:            match.category,
      source,
      action,
      suggestedActions:    match.suggestedActions || [],
      followUpSuggestions,
      sessionId:           normalizedUserId,
    });

  } catch (err) {
    console.error('❌ Chatbot error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      ...(process.env.NODE_ENV === 'development' ? { details: err.message } : {}),
    });
  }
});

// ─── GET /api/chatbot/history/:userId ────────────────────────────────────────
router.get('/history/:userId', (req, res) => {
  const session = sessions.get(req.params.userId);
  res.json({
    success:       true,
    messages:      session ? session.messages.slice(-30) : [],
    sessionExists: !!session,
    startTime:     session?.startTime,
  });
});

// ─── DELETE /api/chatbot/history/:userId ─────────────────────────────────────
router.delete('/history/:userId', (req, res) => {
  sessions.delete(req.params.userId);
  res.json({ success: true, message: 'History cleared' });
});

module.exports = router;
