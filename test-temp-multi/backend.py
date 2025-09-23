
from typing import List, Dict
import asyncio
import json

class UserManager:
    def __init__(self):
        self.users: List[Dict] = []
        self.db_connection = None
    
    async def fetch_users(self) -> List[Dict]:
        """Fetch users from database"""
        query = "SELECT * FROM users"
        result = await self.db_connection.execute(query)
        return result.fetchall()
    
    def add_user(self, user_data: Dict) -> bool:
        """Add a new user"""
        if self.validate_user(user_data):
            self.users.append(user_data)
            return True
        return False
    
    @staticmethod
    def validate_user(user_data: Dict) -> bool:
        required_fields = ['name', 'email']
        return all(field in user_data for field in required_fields)

def main():
    manager = UserManager()
    user = {"name": "John", "email": "john@example.com"}
    manager.add_user(user)

if __name__ == "__main__":
    main()
