from rest_framework import permissions, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "link", "is_read", "created_at"]


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def notification_list(request):
    """The latest 50 notifications plus how many are unread."""
    qs = Notification.objects.filter(user=request.user)
    return Response({
        "unread": qs.filter(is_read=False).count(),
        "results": NotificationSerializer(qs[:50], many=True).data,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def mark_read(request):
    """Body: {"ids": [1, 2]} marks those; no ids marks everything read."""
    qs = Notification.objects.filter(user=request.user, is_read=False)
    ids = request.data.get("ids")
    if ids:
        qs = qs.filter(id__in=[int(i) for i in ids if str(i).isdigit()])
    updated = qs.update(is_read=True)
    return Response({"updated": updated})
