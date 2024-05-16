# Pink Trombone Studio
A simple app for creating speech sequences for [Pink Trombone](https://dood.al/pinktrombone/).

## Install
- ```git clone --recurse-submodules``` this repo into a folder of your choice. Don't forget the ```--recurse-submodules```!
- ```cd``` into cloned directory
- ```npm install``` to install nodeJS dependencies

## Usage
This app is designed to work alongside [Modular Pink Trombone](https://github.com/yonatanrozin/Modular_Pink_Trombone/tree/React), a refactorization of the original Pink Trombone that allows for polyphony and more efficient audio processing.

### Recording speech
- Hold SPACE while dragging around the interface to record frames. Release SPACE when finished recording.
  - __NOTE: the UI won't behave like the original while recording - vocal tract diameters will move instantly. To create smooth constriction animations, you must move your mouse manually. This means some parameters like velum and constriction won't behave as normal, and must be edited in post.__
- ALternatively, import a JSON file containing a saved recording. Be sure the file contains a usable recording, as the app will currently crash if it doesn't. (fix coming soon)
- Once a recording is finished, the recording editor UI will appear, where you can edit the recording as needed.

### Speech editor
The speech editor GUI will graph the values of key audio parameters per recording frame.
- Use the slider to scrub through the frames of your recording. The Tract UI and voice will sonify the current frame automatically, allowing you to listen to your recording.
- To edit a parameter value, select the desired property from the dropdown menu. The corresponding line on the graph will be highlighted. Click/drag on the graph to edit the property values.
- Hold the "extend frame" button to insert new copies of the current frame into the recording. This can be used to slow certain portions of the recording or have a single frame "last" longer.
- Use the "delete frame" button to delete the current frame.
- Add a tongue adjustment using the "add" button. Once added, set the adjustment position manually using the number inputs or set it to the current position of the tongue in the Tract UI. See "speech recording details" section for more info.
- Click "copy JSON" to copy the JSON string literal containing your recording to your computer's clipboard, or download the recording as a JSON file.

## Editing Speech Recordings
Docs coming soon.
