import random
import uuid
import json
from datetime import datetime, timedelta

users = {
    'ayush2': '699f3b33-ccd7-4b14-99de-10560e32150d',
    'ayush_t': '00261715-f8ee-41c9-b334-706177aba732',
    'vardhak_dev': '64d4b754-d8ec-4d05-8885-65a5156e6a74'
}

clubs = {
    'Tech': '31520568-64a0-4260-8775-ccdaf71ca007',
    'Gaming': '433227d3-4281-4e32-b75e-b3c90d76c072',
    'Cinema': 'bfb70389-9006-4212-8446-ced7002cbc49',
    'Music': '3e393ad8-7ff7-4043-b9e1-067f2e52b09e',
    'Anime': 'a391eb96-4373-4fec-b635-1f5876cbc887',
    'Fitness': 'fc074875-cf3c-4e2e-a60b-ceb1645f5372'
}

post_ideas = {
    'Tech': [
        ('What is the best AI coding assistant currently?', 'I have been trying out a few, but what do you all think?'),
        ('Just built my first PC! 🥳', 'Specs: RTX 4070, Ryzen 7 7800X3D, 32GB RAM. Super happy!'),
        ('Any good resources for learning Rust?', 'I want to build highly concurrent systems. Books or courses recommended?'),
        ('Linux vs Windows for development in 2026', 'Is WSL good enough or should I just dual boot?'),
        ('Thoughts on the new OpenAI model?', 'It seems crazy fast but hallucination is still an issue sometimes.')
    ],
    'Gaming': [
        ('What is your GOTY so far?', 'There are so many good releases, I can hardly keep track.'),
        ('Anyone playing the new Helldivers update?', 'The new stratagems are completely broken lol.'),
        ('Looking for a good indie game', 'I loved Hollow Knight and Hades. Suggestions?'),
        ('Is the PS5 Pro worth it?', 'I have a 4K TV but still on base PS5. Thoughts?'),
        ('CS2 Premier mode is full of cheaters again', 'Valve really needs to fix their anti-cheat.')
    ],
    'Cinema': [
        ('Dune 3 predictions?', 'Villeneuve said it is his last one. How will he end it?'),
        ('Most underrated movie of the 2010s?', 'For me it is Arrival or Blade Runner 2049.'),
        ('Just watched Interstellar again', 'Hans Zimmer\'s score never gets old.'),
        ('Thoughts on the new Marvel phase?', 'Seems like they are finally finding their footing again after a rough patch.'),
        ('Best A24 horror movie?', 'Hereditary still messes me up to this day.')
    ],
    'Music': [
        ('What is your Album of the Year?', 'So many great drops this year.'),
        ('Best headphones for under $200?', 'Mainly listening to hip-hop and electronic.'),
        ('Started collecting vinyls!', 'Just got my first turntable. What should be my first record?'),
        ('Anyone going to Coachella this year?', 'The lineup is actually pretty decent for once.'),
        ('Underrated artists you want to share?', 'Looking to expand my playlist.')
    ],
    'Anime': [
        ('One Piece latest chapter discussion!!', 'Absolutely crazy reveal this week. Oda is a genius.'),
        ('Best animation studio right now?', 'MAPPA or Ufotable? Which one takes the crown?'),
        ('Need recommendations for a short, complete anime', '12-24 episodes max. No cliffhangers.'),
        ('Rewatching Fullmetal Alchemist: Brotherhood', 'Still holds up as a 10/10 masterpiece.'),
        ('What are you watching this season?', 'Lots of good isekai but looking for something different.')
    ],
    'Fitness': [
        ('How do you break through a bench plateau?', 'Been stuck at 225 for a month.'),
        ('Best protein powder flavor?', 'Tired of generic chocolate/vanilla. Need something better.'),
        ('Cutting vs Bulking advice', 'Do you guys do clean bulks or dirty bulks?'),
        ('Cardio before or after lifting?', 'I have heard conflicting opinions on this.'),
        ('Form check on my deadlift', 'I feel some lower back pain after going heavy. Tips?')
    ]
}

comments_ideas = [
    "I totally agree with this!",
    "Interesting take, but I see it differently.",
    "Can you share a link to that?",
    "Haha that's exactly what happened to me.",
    "This is so true 😭",
    "Great post, thanks for sharing.",
    "I never thought about it that way.",
    "Could you elaborate more?",
    "Bro literally yes.",
    "nah this ain't it"
]

def generate_embedding():
    return [round(random.uniform(-1, 1), 3) for _ in range(128)]

sql_statements = []

# 1. Update Existing Posts to have likes/dislikes
sql_statements.append("-- 1. Update existing posts randomly")
sql_statements.append("UPDATE posts SET like_count = floor(random() * 20), dislike_count = floor(random() * 5);")

# Generate new posts
new_posts = []

base_time = datetime.now()

# 2. Insert new posts
sql_statements.append("-- 2. Insert new posts")
for club_name, ideas in post_ideas.items():
    club_id = clubs[club_name]
    for title, content in ideas[:1]: # 1 per club = 6 new posts
        post_id = str(uuid.uuid4())
        user_name = random.choice(list(users.keys()))
        user_id = users[user_name]
        created_at = base_time - timedelta(days=random.randint(0, 20), hours=random.randint(0, 23))
        like_count = random.randint(1, 25)
        dislike_count = random.randint(0, 5)
        vector_str = f"'{json.dumps(generate_embedding())}'"
        
        sql = f"""INSERT INTO posts (id, club_id, user_id, title, content, like_count, dislike_count, created_at, embedding) 
VALUES ('{post_id}', '{club_id}', '{user_id}', '{title.replace("'", "''")}', '{content.replace("'", "''")}', {like_count}, {dislike_count}, '{created_at.strftime("%Y-%m-%d %H:%M:%S")}', {vector_str});"""
        sql_statements.append(sql)
        new_posts.append({'id': post_id, 'likes': like_count, 'dislikes': dislike_count, 'club': club_id})

# 3. Create club memberships ensuring all users are in all clubs used
sql_statements.append("-- 3. Ensure memberships")
for user_name, user_id in users.items():
    for club_id in clubs.values():
        sql = f"""INSERT INTO club_members (user_id, club_id) VALUES ('{user_id}', '{club_id}') ON CONFLICT DO NOTHING;"""
        sql_statements.append(sql)

# 4. Generate some comments for the new posts
sql_statements.append("-- 4. Insert comments")
for post in new_posts:
    if random.random() < 0.7:  # 70% chance to have a comment
        num_comments = random.randint(1, 4)
        post_id = post['id']
        club_id = post['club']
        for _ in range(num_comments):
            comment_id = str(uuid.uuid4())
            user_name = random.choice(list(users.keys()))
            user_id = users[user_name]
            content = random.choice(comments_ideas)
            created_at = base_time - timedelta(days=random.randint(0, 2))
            
            sql = f"""INSERT INTO comments (id, post_id, club_id, user_id, content, created_at) 
VALUES ('{comment_id}', '{post_id}', '{club_id}', '{user_id}', '{content.replace("'", "''")}', '{created_at.strftime("%Y-%m-%d %H:%M:%S")}');"""
            sql_statements.append(sql)

# 5. Update comment count on posts
sql_statements.append("-- 5. Update comment counts")
sql_statements.append(
    "UPDATE posts p SET comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = p.id);"
)

with open('seed.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_statements))

print("seed.sql generated successfully")
