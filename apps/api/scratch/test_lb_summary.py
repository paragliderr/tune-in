import sys
import codecs
sys.path.insert(0, '.')
import feedparser

sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

feed = feedparser.parse('https://letterboxd.com/dave/rss/')
for e in feed.entries[:3]:
    print('TITLE:', e.get('title'))
    if e.get('summary'):
        print('RAW SUMMARY:', type(e.get('summary')), repr(e.get('summary')))
    else:
        print('RAW SUMMARY: None')
    print('-'*50)
