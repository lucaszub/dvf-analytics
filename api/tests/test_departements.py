DEPT_CODES = {"22", "29", "35", "56"}
TYPE_LOCAUX = {"Maison", "Appartement"}


def test_list_all_returns_200(client):
    r = client.get("/departements")
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0


def test_response_schema(client):
    r = client.get("/departements?annee=2023")
    assert r.status_code == 200
    item = r.json()[0]
    assert "code" in item
    assert "annee" in item
    assert "type_local" in item
    assert "prix_median_m2" in item
    assert "nb_transactions" in item
    assert "commune_plus_chere" in item
    assert "commune_moins_chere" in item
    assert "evolution_pct_n1" in item


def test_annee_filter_isolates_year(client):
    r = client.get("/departements?annee=2023")
    data = r.json()
    assert all(d["annee"] == 2023 for d in data)


def test_annee_filter_returns_4_depts(client):
    r = client.get("/departements?annee=2023")
    data = r.json()
    codes = {d["code"] for d in data}
    assert codes == DEPT_CODES


def test_annee_filter_returns_correct_types(client):
    r = client.get("/departements?annee=2023")
    data = r.json()
    types = {d["type_local"] for d in data}
    assert types == TYPE_LOCAUX


def test_gold_path_commune_extremes_populated(client):
    """En chemin gold (sans mois), les communes extrêmes doivent être renseignées."""
    r = client.get("/departements?annee=2023")
    data = r.json()
    for d in data:
        assert d["commune_plus_chere"] is not None, f"commune_plus_chere null pour {d['code']}"
        assert d["commune_moins_chere"] is not None, f"commune_moins_chere null pour {d['code']}"


def test_gold_path_evolution_populated_after_2018(client):
    """Evolution N-1 doit être calculée à partir de 2019."""
    r = client.get("/departements?annee=2023")
    data = r.json()
    assert all(d["evolution_pct_n1"] is not None for d in data)


def test_first_year_evolution_null(client):
    """2020 = première année disponible, evolution N-1 doit être null."""
    r = client.get("/departements?annee=2020")
    data = r.json()
    assert all(d["evolution_pct_n1"] is None for d in data)


def test_mois_filter_silver_path(client):
    """Le chemin silver (mois fourni) renvoie des données sans extrêmes ni évolution."""
    r = client.get("/departements?annee=2023&mois=6")
    assert r.status_code == 200
    data = r.json()
    if data:
        assert all(d["commune_plus_chere"] is None for d in data)
        assert all(d["commune_moins_chere"] is None for d in data)
        assert all(d["evolution_pct_n1"] is None for d in data)


def test_mois_filter_nb_transactions_lower(client):
    """Transactions mensuelles < transactions annuelles."""
    r_annual = client.get("/departements?annee=2023")
    r_mois = client.get("/departements?annee=2023&mois=6")
    annual_total = sum(d["nb_transactions"] for d in r_annual.json())
    mois_total = sum(d["nb_transactions"] for d in r_mois.json())
    assert mois_total < annual_total


def test_35_more_expensive_than_22(client):
    """Ille-et-Vilaine (35) doit avoir un prix médian > Côtes-d'Armor (22)."""
    r = client.get("/departements?annee=2023")
    data = r.json()
    maisons = {d["code"]: d["prix_median_m2"] for d in data if d["type_local"] == "Maison"}
    assert maisons["35"] > maisons["22"]
