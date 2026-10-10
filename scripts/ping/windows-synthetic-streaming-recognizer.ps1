param([switch] $CompileOnly)
$ErrorActionPreference = 'Stop'
# Fixed offline stdin/stdout peer. No path, credential, network or microphone arguments.
$source = @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Threading;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using System.Speech.Recognition;
using System.Speech.AudioFormat;
namespace PingWindowsStream {
public sealed class Audio : Stream {
 readonly int expected; public Audio(int declaredBytes) { if(declaredBytes<2 || declaredBytes>1440000 || declaredBytes%2!=0) throw new InvalidDataException(); expected=declaredBytes; }
 readonly object gate=new object(); readonly Queue<byte[]> chunks=new Queue<byte[]>();
 byte[] current=null; int offset=0; public int Received=0, Consumed=0, Frames=0; public bool Finished=false, Failed=false;
 readonly MemoryStream admitted=new MemoryStream();
 public void Append(int ordinal, byte[] bytes) { lock(gate) {
  if(Finished || Failed || ordinal!=Frames+1 || bytes.Length<2 || bytes.Length>9600 || bytes.Length%2!=0 || Received+bytes.Length>expected) throw new InvalidDataException();
  Frames++; Received+=bytes.Length; admitted.Write(bytes,0,bytes.Length); chunks.Enqueue(bytes); Monitor.PulseAll(gate);
 }}
 public void Finish(int frames,int bytes,string sha) { lock(gate) {
  if(Finished || Failed || frames!=Frames || bytes!=Received || bytes!=expected) throw new InvalidDataException();
  using(var h=SHA256.Create()) { var digest=BitConverter.ToString(h.ComputeHash(admitted.ToArray())).Replace("-","").ToLowerInvariant();
   if(digest!=sha) throw new InvalidDataException(); }
  Finished=true; Monitor.PulseAll(gate);
 }}
 public void Cancel() { lock(gate) { Failed=true; Monitor.PulseAll(gate); } }
 public override int Read(byte[] buffer,int start,int count) { lock(gate) {
  if(count==0) return 0; // Normal Stream zero-count semantics; positive reads own the EOF barrier.
  int written=0;
  while(written<count) {
   if(Failed) throw new IOException();
   if(current==null || offset==current.Length) { current=null; offset=0;
    while(chunks.Count==0 && !Finished && !Failed) Monitor.Wait(gate);
    if(Failed) throw new IOException();
    if(chunks.Count==0 && Finished) break;
    current=chunks.Dequeue();
   }
   int n=Math.Min(count-written,current.Length-offset);
   // SAPI can infer EOF from Position==Length without a further Read. Never expose the final bytes before verified Finish.
   if(Consumed+n==expected) {
    while(!Finished && !Failed) Monitor.Wait(gate);
    if(Failed) throw new IOException();
   }
   Buffer.BlockCopy(current,offset,buffer,start+written,n);
   offset+=n; written+=n; Consumed+=n;
  }
  return written; // Only explicit drained Finish returns a short read or zero EOF.
 }}
 public override bool CanRead { get{return true;} } public override bool CanSeek { get{return false;} } public override bool CanWrite { get{return false;} }
 public override long Length { get{return expected;} } public override long Position { get{return Consumed;} set{throw new NotSupportedException();} }
 public override void Flush(){} public override long Seek(long a,SeekOrigin b){ lock(gate) {
  if((b==SeekOrigin.Current && a==0) || (b==SeekOrigin.Begin && a==Consumed)) return Consumed;
  throw new NotSupportedException();
 }}
 public override void SetLength(long a){throw new NotSupportedException();} public override void Write(byte[] a,int b,int c){throw new NotSupportedException();}
}
public static class Peer {
 static readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=32768, RecursionLimit=8 };
 static string Line() { var chars=new List<char>(); int c;
  while((c=Console.Read())!=-1) { if(c==10) return new string(chars.ToArray()).TrimEnd('\r'); if(chars.Count>=14000) throw new InvalidDataException(); chars.Add((char)c); }
  throw new EndOfStreamException(); }
 static Dictionary<string,object> Message() { return json.Deserialize<Dictionary<string,object>>(Line()); }
 static void Keys(Dictionary<string,object> v,params string[] keys) { if(v.Count!=keys.Length) throw new InvalidDataException(); foreach(var k in keys) if(!v.ContainsKey(k)) throw new InvalidDataException(); }
 static int Number(object v) { if(!(v is int) || (int)v<0) throw new InvalidDataException(); return (int)v; }
 static void PlainPath(string path) {
  var full=Path.GetFullPath(path); string current=full;
  while(!String.IsNullOrEmpty(current)) {
   if(File.Exists(current) || Directory.Exists(current)) {
    if((File.GetAttributes(current)&FileAttributes.ReparsePoint)!=0) throw new InvalidDataException();
   } else throw new InvalidDataException();
   var parent=Path.GetDirectoryName(current); if(parent==current) break; current=parent;
  }
 }
 static byte[] BoundedFile(string file,int cap) {
  PlainPath(file);
  using(var stream=File.Open(file,FileMode.Open,FileAccess.Read,FileShare.Read)) {
   if(stream.Length<1 || stream.Length>cap) throw new InvalidDataException();
   using(var copy=new MemoryStream()) { byte[] block=new byte[4096]; int n;
    while((n=stream.Read(block,0,block.Length))>0) { if(copy.Length+n>cap) throw new InvalidDataException(); copy.Write(block,0,n); }
    return copy.ToArray();
   }
  }
 }
 static bool CorpusMember(string digest,int expected) {
  // No caller path/hash list: fixed gitignored custody bootstrap plus immutable whole-manifest commitment.
  var bootstrap=Path.Combine(Directory.GetCurrentDirectory(),"scripts","ping","comparison",".synthetic-custody-bootstrap.json");
  var parser=new JavaScriptSerializer {MaxJsonLength=262144,RecursionLimit=16};
  var locator=parser.Deserialize<Dictionary<string,object>>(System.Text.Encoding.UTF8.GetString(BoundedFile(bootstrap,4096)));
  Keys(locator,"manifestPath","sourceRepositoryPath"); if(!(locator["sourceRepositoryPath"] is string)) throw new InvalidDataException(); var file=Path.GetFullPath((string)locator["manifestPath"]);
  if(!file.StartsWith(@"D:\Codex-scratch\project-ping\",StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException();
  var bytes=BoundedFile(file,262144);
  using(var hash=SHA256.Create()) {
   if(BitConverter.ToString(hash.ComputeHash(bytes)).Replace("-","").ToLowerInvariant()!=
    "95bc1e6206b7d482f4807c79efa94eb8ab38f71a57ff99e8c07623ce8bd634bd") throw new InvalidDataException();
  }
  var manifest=parser.Deserialize<Dictionary<string,object>>(System.Text.Encoding.UTF8.GetString(bytes));
  if(Number(manifest["audioTotal"])!=42 || Number(manifest["sourceTotal"])!=43) throw new InvalidDataException();
  var entries=manifest["entries"] as System.Collections.IList;
  if(entries==null || entries.Count!=42) throw new InvalidDataException();
  bool member=false;
  foreach(var item in entries) {
   var entry=item as Dictionary<string,object>; if(entry==null) throw new InvalidDataException();
   var sha=entry["pcmSha256"] as string; int count=Number(entry["decodedBytes"]);
   if(sha==null || !System.Text.RegularExpressions.Regex.IsMatch(sha,"^[a-f0-9]{64}$") || count<2 || count>1440000 || count%2!=0) throw new InvalidDataException();
   if(sha==digest && count==expected) member=true;
  }
  return member;
 }
 public static bool StreamSelfTest() {
  try {
   using(var a=new Audio(8)) {
    if(a.Length!=8) return false;
    byte[] output=new byte[8]; int read=-1;
    var reading=new Thread(()=>{read=a.Read(output,0,8);}); reading.IsBackground=true; reading.Start();
    a.Append(1,new byte[]{0,128,255,127});
    if(reading.Join(50)) return false;
    a.Append(2,new byte[]{1,0,255,255});
    if(reading.Join(50) || a.Consumed==8 || a.Position==a.Length) return false;
    if(a.Read(new byte[0],0,0)!=0) return false;
    a.Finish(2,8,"5a5f779a26ff0219a631e0884c473744a35e80cb37966978102641a3ddb007a7");
    if(!reading.Join(1000) || read!=8 || a.Consumed!=8 || a.Read(new byte[2],0,2)!=0 ||
      a.Seek(0,SeekOrigin.Current)!=8 || a.Seek(8,SeekOrigin.Begin)!=8) return false;
    try{a.Seek(0,SeekOrigin.Begin);return false;}catch(NotSupportedException){}
    try{a.Append(3,new byte[]{0,0});return false;}catch(InvalidDataException){}
   }
   using(var a=new Audio(2)) {
    bool cancelled=false; var waiting=new Thread(()=>{try{a.Read(new byte[2],0,2);}catch(IOException){cancelled=true;}});
    waiting.IsBackground=true; waiting.Start(); a.Append(1,new byte[]{0,0});
    if(waiting.Join(50) || a.Consumed!=0) return false;
    a.Cancel(); if(!waiting.Join(1000) || !cancelled) return false;
   }
   return true;
  }catch{return false;}
 }
 public static int Run() {
  try {
   RecognizerInfo info=null; foreach(var i in SpeechRecognitionEngine.InstalledRecognizers()) if(i.Id=="MS-1033-80-DESK" && i.Culture.Name=="en-US") info=i;
   if(info==null) throw new InvalidOperationException();
   Console.WriteLine("{\"type\":\"ready\",\"recognizer\":\"MS-1033-80-DESK\",\"format\":\"pcm_s16le_mono_24000\"}"); Console.Out.Flush();
   var begin=Message(); Keys(begin,"type","bytes","sha256"); if((string)begin["type"]!="begin") throw new InvalidDataException();
   int expected=Number(begin["bytes"]); string digest=(string)begin["sha256"];
   if(expected<2 || expected>1440000 || expected%2!=0 ||
    (digest!="1cca7d6955870af3621f0b7298f3d105de1cf1293c3f68c8eb43cec380b3ab77" && digest!="5a5f779a26ff0219a631e0884c473744a35e80cb37966978102641a3ddb007a7" && !CorpusMember(digest,expected))) throw new InvalidDataException();
   using(var audio=new Audio(expected)) using(var done=new ManualResetEvent(false)) using(var r=new SpeechRecognitionEngine(info)) {
    var segments=new List<Dictionary<string,string>>(); object gate=new object(); bool complete=false,ended=false,cancelled=false,error=false,timedOut=false,late=false;
    r.SpeechRecognized+=(sender,args)=> { lock(gate) { if(complete) {late=true; return;} if(args.Result==null || String.IsNullOrWhiteSpace(args.Result.Text) || segments.Count>=64) {error=true; return;}
     segments.Add(new Dictionary<string,string>{{"text",args.Result.Text}}); } };
    r.SpeechRecognitionRejected+=(sender,args)=> { lock(gate) {error=true;} };
    r.RecognizeCompleted+=(sender,args)=> { lock(gate) { if(complete) {late=true;return;} complete=true; ended=args.InputStreamEnded; cancelled=args.Cancelled; error=error || args.Error!=null; } done.Set(); };
    r.LoadGrammar(new DictationGrammar());
    r.SetInputToAudioStream(audio,new SpeechAudioFormatInfo(EncodingFormat.Pcm,24000,16,1,48000,2,null));
    var receiver=new Thread(()=> { try {
     for(int n=0;n<152;n++) { var v=Message(); string type=(string)v["type"];
      if(type=="frame") { Keys(v,"type","ordinal","data"); string data=(string)v["data"]; if(data.Length>12800) throw new InvalidDataException();
       byte[] bytes=Convert.FromBase64String(data); if(Convert.ToBase64String(bytes)!=data) throw new InvalidDataException(); audio.Append(Number(v["ordinal"]),bytes); }
      else if(type=="finish") { Keys(v,"type","frames","bytes","sha256"); if(Number(v["bytes"])!=expected || (string)v["sha256"]!=digest) throw new InvalidDataException();
       audio.Finish(Number(v["frames"]),expected,digest); return; }
      else throw new InvalidDataException();
     }
     throw new InvalidDataException();
    } catch { lock(gate){error=true;} audio.Cancel(); try{r.RecognizeAsyncCancel();}catch{} done.Set(); } });
    receiver.IsBackground=true; receiver.Start(); r.RecognizeAsync(RecognizeMode.Multiple);
    if(!done.WaitOne(10000)) { timedOut=true; audio.Cancel(); r.RecognizeAsyncCancel(); done.WaitOne(2000); }
    if(!complete || !ended || cancelled || error || timedOut || late || !audio.Finished || audio.Received!=expected || audio.Consumed!=expected || !receiver.Join(2000)) throw new InvalidDataException();
    r.Dispose(); lock(gate) {
     if(late || error) throw new InvalidDataException();
     string output=json.Serialize(new {type="complete",frames=audio.Frames,bytes=expected,sha256=digest,consumedBytes=audio.Consumed,
      inputStreamEnded=true,cancelled=false,timedOut=false,error=false,segments=segments});
     if(output.Length>16000) throw new InvalidDataException(); Console.WriteLine(output); Console.Out.Flush();
    }
   }
   return 0;
  } catch { Console.WriteLine("{\"type\":\"failure\"}"); Console.Out.Flush(); return 1; }
 }
}
}
'@
try {
 Add-Type -AssemblyName System.Speech
 Add-Type -AssemblyName System.Web.Extensions
 Add-Type -TypeDefinition $source -ReferencedAssemblies System.Speech,System.Web.Extensions -ErrorAction Stop
 if ($CompileOnly) {
  if (-not [PingWindowsStream.Peer]::StreamSelfTest()) { Write-Output '{"type":"stream_self_test_failed"}'; exit 1 }
  Write-Output '{"type":"compile_only_pass","streamSelfTest":true,"recognitionStarted":false}'; exit 0
 }
 exit ([PingWindowsStream.Peer]::Run())
} catch { Write-Output '{"type":"failure"}'; exit 1 }
