import { useCallback, useEffect, useRef, useState } from "react";
import { map } from "./utils";
import { RPT_Voice } from "./RPT/RPT";

export type Recording = Recording_Frame[];
export type Recording_Frame = {
	ci: number, // constriction index
	cd: number, // constriction diameter
	ti: number,
	td: number,
	v: number, //velum target (0.01 - 0.4)
	t: number, //voice tenseness multiplier (0-1)
	i: number, //voice intensity (0-1)
	n: number, //noise volume (0-1)
}

export const fProps: Record<string, {min: number, max: number, color: string, name: string}> = {
    ci: {min: 0, max: 44, color: "rgb(0, 0, 100)", name: "Constriction Index"},
    cd: {min: 0, max: 3.5, color: "rgb(0, 0, 150)", name: "Constriction Diameter"},
	ti: {min: 12, max: 20, color: "rgb(0, 100, 0)", name: "Tongue Index"},
    td: {min: 2.05, max: 3.5, color: "rgb(0, 150, 0)", name: "Tongue Diameter"},
    i: {min: 0, max: 1, color: "red", name: "Intensity"},
    t: {min: 0, max: 1, color: "orange", name: "Tenseness"},
    v: {min: 0.01, max: 0.4, color: "purple", name: "Velum Target"},
    n: {min: 0, max: 1, color: "magenta", name: "Noise"},
}

export default function RecordingStudio(props: {
	currentRecording: string, setRecordings: React.Dispatch<React.SetStateAction<Record<string, Recording>>>, 
    voice?: RPT_Voice, recordings: Record<string, Recording>
}) {

    const {recordings, setRecordings, voice, currentRecording} = props;
	
    const [mouseStart, setMouseStart] = useState<{x: number, y: number, val: number}>();
    const [mousePos, setMousePos] = useState<[number, number]>();
    const [shiftHeld, setShiftHeld] = useState(false);
    const [pEditing, setPEditing] = useState<string>();
    const [currentFrame, setCurrentFrame] = useState<number>(0);
    const [frameObj, setFrameObj] = useState<Recording_Frame>();
    
    const cnvRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<number>();

	function set(rec: Recording) {
		recordings[currentRecording] = rec;
        setRecordings(recordings);
	} 

    const recording = recordings[currentRecording];

    function reverseRecording() {
        recording.reverse();
        set(recording);
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
        if (recording) setCurrentFrame(Math.min(Math.max(0, currentFrame), recording.length - 1));
        setFrameObj(recording?.[currentFrame]);
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
            for (let i = 0; i < rec.length; i++) {
                const propVal = rec[i][p];

                const x = i/(rec.length - 1) * width;
                const y = map(propVal, pInfo.min, pInfo.max, height-10, 10);
                
                if (i) ctx.lineTo(x, y); 
                else ctx.moveTo(x, y);
            }
            ctx.stroke();

            if (frameObj) {
                const x = currentFrame/(rec.length - 1) * width;
                const y = map(frameObj[p], fProps[p].min, fProps[p].max, height-10, 10);
                ctx.fillText(frameObj[p].toFixed(2), x < width-100? x+5 : x-75, y > 30 ? y-5 : y + 30);
            }
        }

        const frameWidth = width / rec.length;
        ctx.fillStyle = "rgba(0, 0, 0, .3)";
        ctx.fillRect(currentFrame/(rec.length - 1) * width - frameWidth/2, 0, width/(rec.length), height);

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

        const i = Math.round(x * (recording.length - 1));
        const val = map(y, 1, 0, fProps[p].min, fProps[p].max);
        recording[i][p] = Number(val.toFixed(3));
        set(recording);
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

        const i1 = Math.round(mouseStart.x * (recording.length - 1));
        const i2 = Math.round(x * (recording.length - 1));

        const val = map(y, 1, 0, fProps[p].min, fProps[p].max);

        if (i1 === i2) recording[i1][p] = Number(val.toFixed(3));

        else {
            for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
                recording[i][p] = Number(map(i, i1, i2, mouseStart.val, val).toFixed(3));
            }
        }

        set(recording);

        if (!shiftHeld) setMouseStart({x, y, val});
        
    }

    function extendFrame(rec: Recording) {
        rec.splice(currentFrame, 0, {...frameObj!});
        set(rec);
    }
    function deleteFrame(rec: Recording) {
        rec.splice(currentFrame, 1);
        setCurrentFrame(Math.min(currentFrame, rec.length - 1))
        set(rec);
    }

    useEffect(() => {
        if (frameObj && voice) {
            const n = voice.tract.parameters.get("n")!.value;
            voice.tract.parameters.get("constriction-index")!.value = frameObj.ci/44 * n || 0;
            voice.tract.parameters.get("constriction-diameter")!.value = frameObj.cd || 0;
            voice.glottis.parameters.get("intensity")!.value = frameObj.i;
            voice.glottis.parameters.get("tenseness-mult")!.value = frameObj.t;
            voice.tract.parameters.get("velum-target")!.value = frameObj.v;
            voice.tract.parameters.get("fricative-strength")!.value = frameObj.n;

            voice.tract.parameters.get("tongue-index")!.value = frameObj.ti;
			voice.tract.parameters.get("tongue-diameter")!.value = frameObj.td;
        }
    }, [JSON.stringify(frameObj)]);

    return <div>
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
                min={0} max={recording.length - 1} step={1}
                value={currentFrame} onChange={e => setCurrentFrame(Number(e.target.value))}/>
            <button onMouseDown={() => intervalRef.current = setInterval(() => extendFrame(recording), 100)}
                onMouseUp={() => clearInterval(intervalRef.current)}>Extend current frame</button>
            <button onClick={() => deleteFrame(recording)}>Delete current frame</button>
            <button onClick={reverseRecording}>Reverse frames</button>
        </div>}

    </div>
}