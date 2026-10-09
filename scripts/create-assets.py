"""Download editorial photography and synthesize original SONIX demo loops."""
import pathlib, urllib.request, concurrent.futures, wave, math, struct, random, zlib
root = pathlib.Path(__file__).resolve().parents[1] / 'public'
(root/'art').mkdir(parents=True, exist_ok=True)
(root/'audio').mkdir(parents=True, exist_ok=True)
photos = {'hero':'photo-1470225620780-dba8ba36b745', 'night':'photo-1519608487953-e999c86e7455', 'sun':'photo-1470252649378-9c29740c9fa8', 'ocean':'photo-1518837695005-2083093ee35b', 'city':'photo-1514565131-fce0801e5785', 'forest':'photo-1448375240586-882707db888b', 'flower':'photo-1490750967868-88aa4486c946'}
def download(item):
 name,pid=item
 url=f'https://images.unsplash.com/{pid}?auto=format&fit=crop&w={1600 if name=="hero" else 640}&q=85'
 try:
  with urllib.request.urlopen(url,timeout=35) as response: (root/'art'/f'{name}.jpg').write_bytes(response.read())
  print('Photo:',name)
 except Exception as e: print('Photo failed:',name,str(e))
with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:list(pool.map(download,photos.items()))
for j,name in enumerate(['night','sun','ocean','city','forest','flower']):
 rng=random.Random(j); rate=16000; duration=32; data=bytearray(); bpm=[90,80,66,105,72,85][j]; beat=60/bpm
 chords=[[0,3,7],[5,8,12],[8,12,15],[3,7,10]]; rootnote=[45,48,41,43,48,46][j]
 for i in range(rate*duration):
  t=i/rate; chord=chords[int(t/(beat*4))%4]; p=t%beat; envelope=min(1,t/1.5,(duration-t)/2)
  pad=sum(math.sin(2*math.pi*(440*2**((rootnote+n-69)/12))*t + .15*math.sin(t*.4)) for n in chord)/3
  plucknote=rootnote+12+chord[int(t/(beat/2))%3]; pluck=math.sin(2*math.pi*440*2**((plucknote-69)/12)*t)*math.exp(-7*(t%(beat/2)))
  kick=math.sin(2*math.pi*(48*p+8*(1-math.exp(-p*24))))*math.exp(-p*18)
  hat=(rng.random()*2-1)*math.exp(-(t%(beat/2))*100)
  v=(.20*pad+.16*pluck+.18*kick+.025*hat)*envelope
  data.extend(struct.pack('<h',int(max(-1,min(1,v))*24000)))
 with wave.open(str(root/'audio'/f'{name}.wav'),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(data)
 print('Audio:',name)
def png(size):
 rows=[]
 for y in range(size):
  row=bytearray()
  for x in range(size):
   dark=False
   for cx,h in [(43,23),(69,74),(96,116),(123,74),(149,23)]:
    px=x*192/size;py=y*192/size;r=6.5;cy=min(96+h/2,max(96-h/2,py))
    if (px-cx)**2+(py-cy)**2<r*r:dark=True
   row.extend((23,32,15) if dark else (183,237,105))
  rows.append(b'\0'+row)
 def chunk(t,d):return struct.pack('!I',len(d))+t+d+struct.pack('!I',zlib.crc32(t+d)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
for size in (192,512):(root/f'icon-{size}.png').write_bytes(png(size))
