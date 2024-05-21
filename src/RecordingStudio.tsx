import { useCallback, useEffect, useRef, useState } from "react";
import { map } from "./utils";
import { RPT_Voice } from "./RPT/RPT";

export type Recording = {
    frames: Recording_Frame[], 
    adj?: {i: number, d: number}
};
export type Recording_Frame = {
  ci: number, // constriction index
  cd: number, // constriction diameter
  v: number, //velum target (0.01 - 0.4)
  t: number, //voice tenseness multiplier (0-1)
  i: number, //voice intensity (0-1)
  n: number, //noise volume (0-1)
  ta: number //tongue adjustment (0-1)
}

export const fProps: Record<string, {min: number, max: number, color: string, name: string}> = {
    ci: {min: 0, max: 44, color: "green", name: "Constriction Index"},
    cd: {min: 0, max: 3.5, color: "blue", name: "Constriction Diameter"},
    i: {min: 0, max: 1, color: "red", name: "Intensity"},
    t: {min: 0, max: 1, color: "orange", name: "Tenseness"},
    v: {min: 0.01, max: 0.4, color: "purple", name: "Velum Target"},
    n: {min: 0, max: 1, color: "magenta", name: "Noise"},
    ta: {min: 0, max: 1, color: "limegreen", name: "Tongue Adjustment"}
}

export default function RecordingStudio(props: {
    recording?: Recording, set: React.Dispatch<React.SetStateAction<Recording | undefined>>, 
    voice?: RPT_Voice
}) {

    const {recording, set, voice} = props;

    const [mouseStart, setMouseStart] = useState<{x: number, y: number, val: number}>();
    const [mousePos, setMousePos] = useState<[number, number]>();
    const [shiftHeld, setShiftHeld] = useState(false);
    const [pEditing, setPEditing] = useState<string>();
    const [currentFrame, setCurrentFrame] = useState<number>(0);
    const [frameObj, setFrameObj] = useState<Recording_Frame>();
    
    const cnvRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<number>();

    function reverseRecording() {
        recording?.frames.reverse();
        set({...recording!});
    }

    useEffect(() => {
        window.addEventListener("keydown", handleKeyPress);
        window.addEventListener("keyup", handleKeyRelease);
        return () => {
            window.removeEventListener("keydown", handleKeyPress);
            window.removeEventListener("keyup", handleKeyRelease);
        }
    }, [recording]);

    const handleKeyPress = useCallback((e: KeyboardEvent) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            if (!recording) return;
            setCurrentFrame((f) => {return e.key === "ArrowLeft" ? f - 1 : f + 1});
        } else if (e.key === "Shift") {
            e.preventDefault();
            setShiftHeld(true);
        }
    }, [recording, frameObj]);

    const handleKeyRelease = useCallback((e: KeyboardEvent) => {
        if (e.key === "Shift") {
            setShiftHeld(false);
        }
    }, [recording, frameObj]);
    
    useEffect(() => {
        if (recording) setCurrentFrame(Math.min(Math.max(0, currentFrame), recording.frames.length - 1));
        setFrameObj(recording?.frames[currentFrame]);
        if (cnvRef.current && recording) draw(recording, cnvRef.current);
    }, [recording, cnvRef.current, pEditing, currentFrame, JSON.stringify(frameObj), mousePos]);

    function draw(rec: Recording, cnv: HTMLCanvasElement) {

        if (!cnv) return;

        const ctx = cnv.getContext("2d")!;
        const {width, height} = cnv;

        ctx.clearRect(0, 0, cnv.width, cnv.height);

        for (const prop of Object.keys(fProps)) {
            const p = prop as keyof Recording_Frame;
            const pInfo = fProps[p];
            ctx.strokeStyle = pInfo.color;
            ctx.fillStyle = pInfo.color;
            ctx.font = "24px sans-serif";
            ctx.lineCap = "round";
            ctx.lineWidth = prop === pEditing ? 5 : .5;
            
            ctx.beginPath();
            for (let i = 0; i < rec.frames.length; i++) {
                const propVal = rec.frames[i][p];

                const x = i/(rec.frames.length - 1) * width;
                const y = map(propVal, pInfo.min, pInfo.max, height-10, 10);
                
                if (i) ctx.lineTo(x, y); 
                else ctx.moveTo(x, y);
            }
            ctx.stroke();

            if (frameObj) {
                const x = currentFrame/(rec.frames.length - 1) * width;
                const y = map(frameObj[p], fProps[p].min, fProps[p].max, height-10, 10);
                ctx.fillText(frameObj[p].toFixed(2), x < width-100? x+5 : x-75, y > 30 ? y-5 : y + 30);
            }
        }

        const frameWidth = width / rec.frames.length;
        ctx.fillStyle = "rgba(0, 0, 0, .3)";
        ctx.fillRect(currentFrame/(rec.frames.length - 1) * width - frameWidth/2, 0, width/(rec.frames.length), height);

        if (mousePos && pEditing) {
            ctx.globalAlpha = .5;
            ctx.fillStyle = fProps[pEditing!].color;
            const [x, y] = mousePos;
            ctx.fillText(String(map(y, 1, 0, fProps[pEditing!].min, fProps[pEditing!].max).toFixed(3)), x * cnv.width, y * cnv.height);
            ctx.globalAlpha = 1;
        }
    }

    function cnvMouseDown(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
        if (!pEditing || !recording) return; 
        
        const p = pEditing as keyof Recording_Frame;
        let x = e.nativeEvent.offsetX/cnvRef.current!.clientWidth;
        let y = e.nativeEvent.offsetY/cnvRef.current!.clientHeight;
        if (x < 0.03) x = 0; else if (x > .97) x = 1;
        if (y < 0.1) y = 0; else if (y > .9) y = 1;

        const i = Math.round(x * (recording.frames.length - 1));
        const val = map(y, 1, 0, fProps[p].min, fProps[p].max);
        recording.frames[i][p] = Number(val.toFixed(3));
        set({...recording});
        setMouseStart({x, y, val});
    }

    function cnvMouseUp() {
        setMouseStart(undefined);
    }

    function cnvMouseMove(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
        e.preventDefault();

        let x = e.nativeEvent.offsetX/cnvRef.current!.clientWidth;
        let y = e.nativeEvent.offsetY/cnvRef.current!.clientHeight;
        setMousePos([x, y]);
        
        
        if (!e.buttons || !mouseStart || !pEditing || !recording) return;

        if (shiftHeld && Math.abs(y - mouseStart.y) < .03) y = mouseStart.y;

        const p = pEditing as keyof Recording_Frame;

        if (y < 0.03) y = 0; else if (y > .97) y = 1;
        if (x < 0.03) x = 0; else if (x > .97) x = 1;

        const i1 = Math.round(mouseStart.x * (recording.frames.length - 1));
        const i2 = Math.round(x * (recording.frames.length - 1));

        const val = map(y, 1, 0, fProps[p].min, fProps[p].max);

        if (i1 === i2) recording.frames[i1][p] = Number(val.toFixed(3));

        else {
            for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
                recording.frames[i][p] = Number(map(i, i1, i2, mouseStart.val, val).toFixed(3));
            }
        }

        set({...recording});

        if (!shiftHeld) setMouseStart({x, y, val});
        
    }

    function extendFrame(rec: Recording) {
        rec.frames.splice(currentFrame, 0, {...frameObj!});
        set({...rec});
    }
    function deleteFrame(rec: Recording) {
        rec.frames.splice(currentFrame, 1);
        setCurrentFrame(Math.min(currentFrame, rec.frames.length - 1))
        set({...rec});
    }

    useEffect(() => {
        if (frameObj && voice) {
            const n = voice.tract.parameters.get("n")!.value;
            const adj = recording?.adj;
            voice.tract.parameters.get("constriction-index")!.value = frameObj.ci/44 * n || 0;
            voice.tract.parameters.get("constriction-diameter")!.value = frameObj.cd || 0;
            voice.glottis.parameters.get("intensity")!.value = frameObj.i;
            voice.glottis.parameters.get("tenseness-mult")!.value = frameObj.t;
            voice.tract.parameters.get("velum-target")!.value = frameObj.v;
            voice.tract.parameters.get("fricative-strength")!.value = frameObj.n;

            voice.tract.parameters.get("tongue-index")!.value = 
                adj && frameObj.ta ? map(frameObj.ta, 0, 1, voice.tongue.i, adj.i/44 * n) : voice.tongue.i;
                voice.tract.parameters.get("tongue-diameter")!.value = 
                adj && frameObj.ta ? map(frameObj.ta, 0, 1, voice.tongue.d, adj.d/44 * n) : voice.tongue.d;
        }
    }, [JSON.stringify(frameObj)]);

    function download(content: {}) {
        const recName = window.prompt("Enter recording name:");
        if (!recName) return;
        const a = document.createElement("a");
        const file = new Blob([JSON.stringify(content)], { type: "application/JSON" });
        a.href = URL.createObjectURL(file);
        a.download = recName + ".json";
        a.click();
    }

    function handleJSONFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = readerEvent => {
            var content = readerEvent.target?.result?.toString();
            if (content) {
                const JSONIn = JSON.parse(content);
                if (validateJSON(JSONIn)) {set(JSONIn); setCurrentFrame(0)};
            }
        }
        reader.readAsText(file);
    }

    function validateJSON(obj: Partial<Recording>) {
        try {
            if (!Array.isArray(obj.frames)) return false;
            else {
                for (let i = 0; i < obj.frames.length; i++) {
                    if (!["ci", "cd", "v", "t", "i", "n", "ta"].every(p => p in obj.frames![i])) return false;
                }
            }
        } catch (e) {return false};
        return true;
    }

    function addTongueAdjustment() {
        recording!.adj = {i: 12.7, d: 2};
        set({...recording!});
    }

    function removeTongueAdjustment() {
        delete recording!.adj;
        set({...recording!});
    }

    function setTongueAdjustment(p: "i" | "d", val: number) {
        recording!.adj![p] = val;
        set({...recording!});
    }

    function getTongueAdjustment() {
        recording!.adj = {i: Number(voice!.tongue.i.toFixed(3)), d: Number(voice!.tongue.d.toFixed(3))};
        set({...recording!});
    }

    return <div>
        <label>Import JSON file<br></br>
            <input type="file" accept=".json" onChange={handleJSONFile}/>
        </label><br/><br/>
        
        {recording && <div style={{display: "flex", flexDirection: "column"}}>
            <label>Property: 
                <select id="propSelect" value={pEditing} onChange={e => setPEditing(e.target.value)}
                    style={{color: pEditing ? fProps[pEditing].color : "black"}}>
                    <option></option>
                    {Object.keys(fProps).map(p =>
                        <option style={{color: fProps[p].color}} key={p} value={p}>{fProps[p].name}</option>
                    )}
                </select>
            </label><br/>
            <canvas width={1200} height={600} style={{width: "100%"}} ref={cnvRef} 
                onMouseDown={cnvMouseDown} onMouseUp={cnvMouseUp}
                onMouseMove={e => cnvMouseMove(e)} onContextMenu={e => e.preventDefault()}/>
            <input type="range" style={{width: "100%", margin: "0px", boxSizing: "border-box"}} 
                min={0} max={recording.frames.length - 1} step={1}
                value={currentFrame} onChange={e => setCurrentFrame(Number(e.target.value))}/>
            <button onMouseDown={() => intervalRef.current = setInterval(() => extendFrame(recording), 100)}
                onMouseUp={() => clearInterval(intervalRef.current)}>Extend current frame</button>
            <button onClick={() => deleteFrame(recording)}>Delete current frame</button>
            <button onClick={reverseRecording}>Reverse frames</button>
            <label>Tongue Adjustment
                {(!recording.adj) && <button onClick={addTongueAdjustment}>Add</button>}
                {recording.adj && <div>
                    <input value={recording.adj.i} type="number" step={0.01}
                        onChange={e => setTongueAdjustment("i", Number(e.target.value))} />    
                    <input value={recording.adj.d} type="number" step={0.01}
                        onChange={e => setTongueAdjustment("d", Number(e.target.value))} />    
                    <button onClick={getTongueAdjustment}>Use current tongue position</button>
                    <button onClick={removeTongueAdjustment}>Remove</button>
                </div>}
            </label>

            <div>
                <button onClick={() => download(recording)}>Download JSON</button>
                <button onClick={() => navigator.clipboard.writeText(JSON.stringify(recording))}>Copy JSON</button>
            </div>
        </div>}

    </div>
}