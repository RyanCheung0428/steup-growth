import os

os.environ.setdefault("CREATE_DB_ON_STARTUP", "false")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app import create_app


def test_api_hi():
    app = create_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        response = client.get("/api/hi")

    assert response.status_code == 200
    assert response.get_json() == {"message": "hi"}

