"""
Fixtures de tests pour DVF Analytics API.

Prérequis : ClickHouse doit tourner avec les données chargées.
  docker compose up -d clickhouse
  docker compose up ingest dbt

Lancer les tests depuis api/ :
  cd api && pip install -r requirements-dev.txt
  pytest
"""
import clickhouse_connect
import pytest
from fastapi.testclient import TestClient

from db import get_client
from main import app


def get_test_client():
    """Client ClickHouse pointant sur le port host (8124) pour les tests locaux."""
    return clickhouse_connect.get_client(
        host="localhost",
        port=8124,
        username="default",
        password="",
    )


@pytest.fixture(scope="session")
def client():
    app.dependency_overrides[get_client] = get_test_client
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
