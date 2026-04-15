class Neo4jGraphBuilder:
    def __init__(self, uri, user, password):
        self.uri = uri
        self.user = user
        self.password = password

        # ✅ MUST ADD THESE
        self.user_id_map = {}
        self.user_supabase_map = {}