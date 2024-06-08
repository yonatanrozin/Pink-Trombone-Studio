import { useEffect, useRef, useState } from 'react'
import Tract, { RPT_Voice } from './RPT/RPT'
import RecordingStudio, {Recording} from './RecordingStudio';

import './App.css'
import MPT from "./RPT/pink_trombone_processor.js?worker&url";

export default function App() {

  const [voice, setVoice] = useState<RPT_Voice>();
  const [ctx, setCtx] = useState<AudioContext>();
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMute, setVoiceMute] = useState(true);
  const [gainNode, setGainNode] = useState<GainNode>();

  const [recordings, setRecordings] = useState<Record<string, Recording>>({});
  const [currentRecording, setCurrentRecording] = useState<string>();
  
  const recIntervalRef = useRef<number>();
  const recordingRef = useRef<Recording>(); //holds the in-progress recording frames

  useEffect(() => {
    const newCtx = new AudioContext();
    setCtx(newCtx);

    const newGain = new GainNode(newCtx, {gain: 0});
    newGain.connect(newCtx.destination);
    setGainNode(newGain);

    window.addEventListener("keydown", e => {
      if (e.key === " ") {e.preventDefault(); setIsRecording(true)};
    });
    window.addEventListener("keyup", e => {
      if (e.key === " ") {e.preventDefault(); setIsRecording(false)};
    }
  )
  }, []);

  useEffect(() => {
    if (!ctx) return;
    (async () => {
      await ctx.audioWorklet.addModule(MPT);
      console.log("Modules added successfully.");
      setVoice(new RPT_Voice("studio", ctx, gainNode));
    })();
  }, [ctx, gainNode]);

  useEffect(() => {
    if (!voice) return;
    voice.connect(); 
    voice.glottis.parameters.get("intensity")!.value = 1;
    (window as any).voice = voice;
  }, [voice]);

  useEffect(() => {
    if (isRecording) startRecording(); 
    else stopRecording();
  }, [isRecording]);

  function startRecording() {
    if (!voice) return;
    recIntervalRef.current = setInterval(recordFrame, 1000/120);
    voice.tract.parameters.get("movement-speed")!.value = -1;
    voice.UI.ignoreTongue = true;
    recordingRef.current = [];
  }

  function recordFrame() {
    if (!voice) return;

    const n = voice.tract.parameters.get("n")!.value;

    recordingRef.current!.push({
      ci: Number((voice.tract.parameters.get("constriction-index")!.value/n * 44).toFixed(3)),
      cd: Number(voice.tract.parameters.get("constriction-diameter")!.value.toFixed(3)),
      ti: Number((voice.tract.parameters.get("tongue-index")!.value/n * 44).toFixed(3)),
      td: Number(voice.tract.parameters.get("tongue-diameter")!.value.toFixed(3)),
      v: Number(voice.tract.parameters.get("velum-target")!.value.toFixed(3)),
      t: 1,
      i: 1,
      n: 1,
    });
  }
  
  function stopRecording() {
    if (!voice || !recordingRef.current) return;
    clearInterval(recIntervalRef.current);
    voice.UI.ignoreTongue = false;
    voice.tract.parameters.get("movement-speed")!.value = voice.tract.parameters.get("movement-speed")!.defaultValue;
    processRecording(recordingRef.current!);
  }

  function processRecording(rec: Recording) {
    for (let i = rec.length - 1; i >= 0; i--) {
      if (JSON.stringify(rec[i-1]) == JSON.stringify(rec[i])) {
        rec.splice(i, 1);
      }
    }
    let recName = window.prompt("Enter recording name:")?.trim();
    if (recName) {
      recordings[recName] = rec;
      setRecordings(recordings);
      setCurrentRecording(recName);
    }
  }

  useEffect(() => {
    if (gainNode && voice) gainNode.gain.setTargetAtTime(voiceMute ? 0 : 1, voice.ctx.currentTime, 0.05);
  }, [voiceMute, voice]);

  function handleJSONFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = readerEvent => {
        var content = readerEvent.target?.result?.toString();
        if (content) {
            const JSONIn = JSON.parse(content) as Record<string, Recording>;
            setRecordings(JSONIn); 
            setCurrentRecording(Object.keys(JSONIn)[0]);
        }
    }
    reader.readAsText(file);
  }

  function download(content: {}) {
    const a = document.createElement("a");
    const file = new Blob([JSON.stringify(content)], { type: "application/JSON" });
    a.href = URL.createObjectURL(file);
    a.download = "recordings.json";
    a.click();
  }

  return <div>
    <h1>Pink Trombone Studio</h1>
    <h3>By Yonatan Rozin</h3>
    <h5>Based on <a href='https://dood.al/pinktrombone/'>Pink Trombone</a> by Neil Thapen (MIT License)</h5>
    <p>Hold SPACE to record speech shapes using the vocal tract UI below.</p>
    <div id="studio">
      <div >
        <label>Mute voice
          <input type="checkbox" checked={voiceMute} onChange={e => {setVoiceMute(e.target.checked); voice?.ctx.resume()}}/>
        </label><br/>
        {voice && <Tract voice={voice}/>}
      </div>

      <div id="editor">
        <div id="recSelect" style={{display: "flex", padding: "10px", gap: "10px"}}>
          <div style={{width: "50%"}}>
            <label>Recording:
              <select value={currentRecording} onChange={e => setCurrentRecording(e.target.value)}>
                {Object.keys(recordings).length == 0 && <option value={undefined} disabled selected>No recordings saved</option>}

                {Object.keys(recordings).map(r =>
                  <option key={`recording${r}`} value={r}>{r}</option>
                  )}
              </select>
            </label>
          </div>
          <div>OR</div>
          <div>
            <label>Import JSON file<br />
              <input type="file" accept=".json" onChange={handleJSONFile}/>
            </label><br/><br/>
          </div>
          
        </div>
        {currentRecording && <RecordingStudio setRecordings={setRecordings} voice={voice} recordings={recordings}
          currentRecording={currentRecording}/>}
        {currentRecording && <button onClick={() => download(recordings)}>Download JSON</button>
      }
        <br/>
      </div>

    </div>
  </div>
}