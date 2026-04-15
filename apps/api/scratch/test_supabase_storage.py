import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def test_storage():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    print(f"URL: {url}")
    print(f"Key exists: {bool(key)}")
    
    if not url or not key:
        print("Missing env variables!")
        return

    supabase = create_client(url, key)
    
    # Test record
    test_uid = "00000000-0000-0000-0000-000000000000"
    test_token = "test_token_123"
    
    try:
        print("\nAttempting upsert to github_tokens...")
        res = supabase.table("github_tokens").upsert({
            "user_id": test_uid,
            "token": test_token
        }, on_conflict="user_id").execute()
        print(f"Success! Response: {res}")
        
        print("\nAttempting delete of test record...")
        supabase.table("github_tokens").delete().eq("user_id", test_uid).execute()
        print("Delete successful!")
        
    except Exception as e:
        print(f"\nFAILED: {str(e)}")

if __name__ == "__main__":
    test_storage()
