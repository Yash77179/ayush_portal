from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase, override_settings

STORAGES = {
    "default": {"BACKEND": "filestore.storage.DatabaseStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


@override_settings(STORAGES=STORAGES)
class DatabaseStorageTests(TestCase):
    def test_save_open_serve_delete(self):
        name = default_storage.save("resumes/cv.pdf", ContentFile(b"%PDF-1.4 hello", name="cv.pdf"))
        self.assertTrue(default_storage.exists(name))
        self.assertEqual(default_storage.size(name), 14)
        self.assertEqual(default_storage.url(name), "/media/resumes/cv.pdf")
        # the same name again gets a new, unique name instead of overwriting
        other = default_storage.save("resumes/cv.pdf", ContentFile(b"%PDF-2", name="cv.pdf"))
        self.assertNotEqual(other, name)

        r = self.client.get("/media/resumes/cv.pdf")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertEqual(b"".join(r.streaming_content), b"%PDF-1.4 hello")

        default_storage.delete(name)
        self.assertEqual(self.client.get("/media/resumes/cv.pdf").status_code, 404)
        self.assertEqual(self.client.get("/media/../manage.py").status_code, 404)
