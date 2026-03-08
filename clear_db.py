import os
from app import create_app, db

def clear_database():
    """Drops all tables and recreates them to clear all data."""
    app = create_app()
    with app.app_context():
        print("Starting database clear-out...")
        try:
            # Drop all tables in the database
            db.drop_all()
            print("All tables dropped.")
            
            # Recreate all tables based on models
            db.create_all()
            print("All tables recreated successfully.")
            
            print("Database has been completely cleared.")
        except Exception as e:
            print(f"An error occurred while clearing the database: {e}")

if __name__ == "__main__":
    clear_database()
