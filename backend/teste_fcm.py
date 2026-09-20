import asyncio
from server import db


async def main():
    user = await db.users.find_one(
        {
            "role": "courier",
            "fcm_token": {
                "$exists": True,
                "$nin": [None, ""],
            },
        },
        {
            "name": 1,
            "email": 1,
            "fcm_token": 1,
            "fcm_platform": 1,
            "fcm_updated_at": 1,
            "online": 1,
        },
    )

    print(user)


asyncio.run(main())
