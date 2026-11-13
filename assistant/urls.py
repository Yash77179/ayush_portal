from django.urls import path

from .tts import tts
from .voices import voices
from .views import ChatView, conversation_detail, conversation_list

urlpatterns = [
    path("chat/", ChatView.as_view(), name="assistant-chat"),
    path("tts/", tts, name="assistant-tts"),
    path("voices/", voices, name="assistant-voices"),
    path("conversations/", conversation_list, name="assistant-conversations"),
    path("conversations/<int:pk>/", conversation_detail, name="assistant-conversation"),
]
