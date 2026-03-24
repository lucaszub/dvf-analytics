ANNEES_ATTENDUES = {2020, 2021, 2022, 2023, 2024}


def test_kpis_global_returns_200(client):
    r = client.get("/bretagne/kpis")
    assert r.status_code == 200
    data = r.json()
    assert set(data.keys()) == {
        "prix_median_bretagne",
        "prix_median_selection",
        "nb_transactions_total",
        "commune_plus_chere",
        "commune_moins_chere",
    }


def test_kpis_global_values_positive(client):
    r = client.get("/bretagne/kpis?annee=2023")
    data = r.json()
    assert data["prix_median_bretagne"] > 0
    assert data["prix_median_selection"] > 0
    assert data["nb_transactions_total"] > 0


def test_kpis_global_commune_extremes_populated(client):
    r = client.get("/bretagne/kpis?annee=2023")
    data = r.json()
    assert data["commune_plus_chere"] is not None
    assert data["commune_moins_chere"] is not None


def test_kpis_dept_35_pricier_than_bretagne(client):
    """Rennes (35) doit avoir un prix médian supérieur à la médiane bretonne."""
    r_global = client.get("/bretagne/kpis?annee=2023&type=Appartement")
    r_35 = client.get("/bretagne/kpis?dept=35&annee=2023&type=Appartement")
    assert r_35.json()["prix_median_selection"] > r_35.json()["prix_median_bretagne"]
    # prix_median_bretagne identique entre les deux appels
    assert r_35.json()["prix_median_bretagne"] == r_global.json()["prix_median_bretagne"]


def test_kpis_mois_returns_200(client):
    r = client.get("/bretagne/kpis?annee=2023&mois=6")
    assert r.status_code == 200
    data = r.json()
    assert data["prix_median_bretagne"] > 0


def test_kpis_mois_no_commune_extremes(client):
    """Le chemin silver (mois) ne renvoie pas les communes extrêmes."""
    r = client.get("/bretagne/kpis?annee=2023&mois=6")
    data = r.json()
    assert data["commune_plus_chere"] is None
    assert data["commune_moins_chere"] is None


def test_historique_returns_all_years(client):
    r = client.get("/bretagne/historique")
    assert r.status_code == 200
    data = r.json()
    annees = {d["annee"] for d in data}
    assert annees == ANNEES_ATTENDUES


def test_historique_prices_positive(client):
    r = client.get("/bretagne/historique")
    for point in r.json():
        assert point["prix_median_m2"] > 0, f"prix nul pour {point['annee']}"


def test_historique_upward_trend_2020_2022(client):
    """Les prix bretons ont augmenté entre 2020 et 2022 (tendance connue DVF)."""
    r = client.get("/bretagne/historique")
    data = {d["annee"]: d["prix_median_m2"] for d in r.json()}
    assert data[2022] > data[2020]


def test_historique_filter_type(client):
    r_maison = client.get("/bretagne/historique?type=Maison")
    r_appt = client.get("/bretagne/historique?type=Appartement")
    assert r_maison.status_code == 200
    assert r_appt.status_code == 200
    assert len(r_maison.json()) == len(ANNEES_ATTENDUES)
    assert len(r_appt.json()) == len(ANNEES_ATTENDUES)


def test_historique_filter_dept(client):
    """Historique filtré par département passe par silver et retourne toutes les années."""
    r = client.get("/bretagne/historique?dept=35")
    assert r.status_code == 200
    data = r.json()
    annees = {d["annee"] for d in data}
    assert annees == ANNEES_ATTENDUES


def test_historique_ordered_by_annee(client):
    r = client.get("/bretagne/historique")
    annees = [d["annee"] for d in r.json()]
    assert annees == sorted(annees)
