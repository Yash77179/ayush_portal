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


CLOUDINARY = {**STORAGES, "default": {"BACKEND": "filestore.storage.CloudinaryStorage"}}


@override_settings(STORAGES=CLOUDINARY)
class CloudinaryStorageTests(TestCase):
    """Cloudinary itself is mocked: these check what we send it and the links we hand out."""

    def setUp(self):
        import cloudinary

        cloudinary.config(cloud_name="demo-cloud", api_key="k", api_secret="s")

    def test_upload_gets_unique_raw_name_and_https_link(self):
        from unittest import mock

        with mock.patch("cloudinary.uploader.upload") as upload:
            name = default_storage.save("resumes/cv.pdf", ContentFile(b"%PDF-1.4", name="cv.pdf"))
        self.assertRegex(name, r"^resumes/cv-[0-9a-f]{8}\.pdf$")
        args, kwargs = upload.call_args
        self.assertEqual(args[0], b"%PDF-1.4")
        self.assertEqual(kwargs["public_id"], name)
        self.assertEqual(kwargs["resource_type"], "raw")
        url = default_storage.url(name)
        self.assertTrue(url.startswith("https://res.cloudinary.com/demo-cloud/raw/upload/"), url)
        self.assertTrue(url.endswith(name))

        r = self.client.get(f"/media/{name}")
        self.assertEqual(r.status_code, 302)
        self.assertEqual(r["Location"], url)

    def test_missing_file_is_reported_as_missing(self):
        from unittest import mock

        import cloudinary.exceptions

        with mock.patch("cloudinary.api.resource", side_effect=cloudinary.exceptions.NotFound("nope")):
            self.assertFalse(default_storage.exists("resumes/gone.pdf"))
            with self.assertRaises(FileNotFoundError):
                default_storage.size("resumes/gone.pdf")
