REQUIRED_KEYS = {"id", "name", "department", "departmentCode", "pricePerSqm", "transactions", "evolution", "coordinates"}


def test_list_all_returns_200(client):
    r = client.get("/communes")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) > 0


def test_response_schema(client):
    r = client.get("/communes?dept=35&annee=2023")
    assert r.status_code == 200
    item = r.json()[0]
    assert set(item.keys()) == REQUIRED_KEYS
    assert isinstance(item["id"], str)
    assert isinstance(item["pricePerSqm"], (int, float))
    assert item["pricePerSqm"] > 0
    assert isinstance(item["transactions"], int)
    assert item["transactions"] > 0
    assert len(item["coordinates"]) == 2


def test_filter_dept_isolates_correct_dept(client):
    r = client.get("/communes?dept=35&annee=2023")
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    assert all(c["departmentCode"] == "35" for c in data)


def test_filter_dept_fewer_than_all(client):
    r_all = client.get("/communes?annee=2023")
    r_35 = client.get("/communes?dept=35&annee=2023")
    assert len(r_35.json()) < len(r_all.json())


def test_filter_type(client):
    r_maison = client.get("/communes?type=Maison&annee=2023")
    r_appt = client.get("/communes?type=Appartement&annee=2023")
    assert r_maison.status_code == 200
    assert r_appt.status_code == 200
    # Les deux types ont des communes distinctes dans le résultat
    assert len(r_maison.json()) > 0
    assert len(r_appt.json()) > 0


def test_invalid_dept_returns_422(client):
    r = client.get("/communes?dept=99")
    assert r.status_code == 422


def test_mois_filter_returns_200(client):
    r = client.get("/communes?dept=35&annee=2023&mois=6")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_mois_filter_evolution_always_null(client):
    """Le chemin silver (mois fourni) ne calcule pas l'évolution N-1."""
    r = client.get("/communes?dept=35&annee=2023&mois=6")
    data = r.json()
    if data:
        assert all(c["evolution"] is None for c in data)


def test_mois_fewer_than_annual(client):
    """Un mois donné contient moins de transactions que toute l'année."""
    r_annual = client.get("/communes?dept=35&annee=2023")
    r_mois = client.get("/communes?dept=35&annee=2023&mois=6")
    annual_transactions = sum(c["transactions"] for c in r_annual.json())
    mois_transactions = sum(c["transactions"] for c in r_mois.json())
    assert mois_transactions < annual_transactions


def test_coordinates_in_bretagne_range(client):
    """Les coordonnées doivent être dans la boîte englobante de la Bretagne."""
    r = client.get("/communes?annee=2023")
    for c in r.json():
        lon, lat = c["coordinates"]
        assert -5.5 <= lon <= 0.0, f"longitude hors Bretagne: {lon} (commune {c['id']})"
        assert 47.0 <= lat <= 49.0, f"latitude hors Bretagne: {lat} (commune {c['id']})"


def test_evolution_nullable_for_first_year(client):
    """2020 = première année disponible, evolution N-1 doit être null."""
    r = client.get("/communes?annee=2020")
    data = r.json()
    assert len(data) > 0
    assert all(c["evolution"] is None for c in data)
