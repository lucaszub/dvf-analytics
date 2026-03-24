from typing import Annotated
import os

import clickhouse_connect
from clickhouse_connect.driver import Client
from fastapi import Depends


def get_client() -> Client:
    return clickhouse_connect.get_client(
        host=os.getenv("CLICKHOUSE_HOST", "localhost"),
        port=8123,
        username="default",
        password="",
    )


ClientDep = Annotated[Client, Depends(get_client)]
