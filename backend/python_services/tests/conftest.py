import os
import sys

# Make `emotion_engine` and `distilbert_emotion_service` importable when pytest
# is run from anywhere (python_services is not a package).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
