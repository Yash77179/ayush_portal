"""A Django storage backend that keeps uploads in the database.

Turned on with FILE_STORAGE=database (see settings). Hosts like Render's free plan have no persistent disk,
so files saved to the filesystem would disappear on every redeploy; the database survives.
"""

import mimetypes

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class DatabaseStorage(Storage):
    def _model(self):
        from .models import StoredFile  # imported lazily: storages are created before apps are ready

        return StoredFile

    def _open(self, name, mode="rb"):
        try:
            f = self._model().objects.get(name=name)
        except self._model().DoesNotExist:
            raise FileNotFoundError(name) from None
        return ContentFile(bytes(f.content), name=name)

    def _save(self, name, content):
        if hasattr(content, "seek"):
            content.seek(0)
        data = content.read()
        if isinstance(data, str):
            data = data.encode()
        content_type = getattr(content, "content_type", None) or mimetypes.guess_type(name)[0] or "application/octet-stream"
        self._model().objects.update_or_create(
            name=name, defaults={"content": data, "size": len(data), "content_type": content_type}
        )
        return name

    def exists(self, name):
        return self._model().objects.filter(name=name).exists()

    def delete(self, name):
        self._model().objects.filter(name=name).delete()

    def size(self, name):
        f = self._model().objects.filter(name=name).only("size").first()
        if f is None:
            raise FileNotFoundError(name)
        return f.size

    def url(self, name):
        return f"{settings.MEDIA_URL}{name}"
