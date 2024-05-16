import { useEffect, useRef, useState } from 'react'
import Tract, { RPT_Voice } from './RPT/RPT'
import RecordingStudio, {Recording} from './RecordingStudio';

import './App.css'

export default function App() {

  const [voice, setVoice] = useState<RPT_Voice>();
  const [ctx, setCtx] = useState<AudioContext>();
  const [isRecording, setIsRecording] = useState(false);
  const [completeRecording, setCompleteRecording] = useState<Recording>(); //holds processed recording
  const [voiceMute, setVoiceMute] = useState(true);
  const [gainNode, setGainNode] = useState<GainNode>();
  
  const recIntervalRef = useRef<number>();
  const recordingRef = useRef<Recording>(); //holds the in-progress recording frames
  const tractCanvasRef = useRef<HTMLCanvasElement>(null);

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
      await ctx.audioWorklet.addModule(new URL('./RPT/pink_trombone_processor.js', import.meta.url));
      console.log("Modules added successfully.");
      setVoice(new RPT_Voice("studio", ctx, gainNode));
    })();
  }, [ctx, gainNode]);

  useEffect(() => {
    if (!voice) return;
    voice.connect(); 
    (window as any).voice = voice
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
    recordingRef.current = {frames: []};
  }

  function recordFrame() {
    if (!voice) return;

    const n = voice.tract.parameters.get("n")!.value;

    if (voice.constriction) recordingRef.current!.frames.push({
      ci: Number(voice.constriction.i.toFixed(3))/n * 44,
      cd: Number(voice.constriction.d.toFixed(3)),
      v: Number(voice.tract.parameters.get("velum-target")!.value.toFixed(3)),
      t: 1,
      i: 1,
      n: voice.constriction? 1 : 0,
      ta: 0
    });
  }
  
  function stopRecording() {
    if (!voice || !recordingRef.current) return;
    clearInterval(recIntervalRef.current);
    voice.UI.ignoreTongue = false;
    voice.tract.parameters.get("movement-speed")!.value = voice.tract.parameters.get("movement-speed")!.defaultValue;

    if (completeRecording && !window.confirm("Overwrite existing recording?")) return;
    processRecording(recordingRef.current!);
  }

  function processRecording(rec: Recording) {
    for (let i = rec.frames.length - 1; i >= 0; i--) {
      if (JSON.stringify(rec.frames[i-1]) == JSON.stringify(rec.frames[i])) {
        rec.frames.splice(i, 1);
      }
    }
    setCompleteRecording({...rec});
  }

  useEffect(() => {
    if (gainNode && voice) gainNode.gain.setTargetAtTime(voiceMute ? 0 : 1, voice.ctx.currentTime, 0.05)
    }, [voiceMute, voice]);

  return <div>
    <h1>Pink Trombone Studio</h1>
    <h3>By Yonatan Rozin</h3>
    <h5>Based on <a href='https://dood.al/pinktrombone/'>Pink Trombone</a> by Neil Thapen (MIT License)</h5>
    <p>Hold SPACE to record speech shapes using the vocal tract UI below. </p>
    <div style={{display: "flex"}}>
      <label>Mute voice
        <input type="checkbox" checked={voiceMute} onChange={e => setVoiceMute(e.target.checked)}/>
      </label>
      {voice && <Tract voice={voice} canvasRef={tractCanvasRef}/>}
      {<RecordingStudio recording={completeRecording} set={setCompleteRecording} voice={voice}/>}
    </div>
  </div>
}