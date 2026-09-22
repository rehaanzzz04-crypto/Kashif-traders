'use strict';
(() => {
  if (window.KT_MEDIA) return;
  const MB = 1024 * 1024;
  const label = bytes => bytes < MB ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / MB).toFixed(1) + ' MB';
  const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Image compression failed')), 'image/jpeg', quality));
  async function image(file) {
    if (!file.type.startsWith('image/')) throw Error('Image file select karein.');
    const bitmap = await createImageBitmap(file), scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');canvas.width = Math.max(1, Math.round(bitmap.width * scale));canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');context.fillStyle = '#fff';context.fillRect(0, 0, canvas.width, canvas.height);context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);bitmap.close?.();
    let blob;for (const quality of [.84,.74,.64,.54,.44,.34]) {blob = await canvasBlob(canvas, quality);if (blob.size <= 680000) break;}
    if (!blob || blob.size > 740000) throw Error('Image compress nahi hui. Choti image select karein.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type:'image/jpeg',lastModified:Date.now()});
  }
  function videoElement(file) {
    return new Promise((resolve, reject) => {const video=document.createElement('video');video.preload='metadata';video.playsInline=true;video.muted=true;video.onloadedmetadata=()=>resolve(video);video.onerror=()=>reject(Error('Video read nahi ho saki.'));video.src=URL.createObjectURL(file);});
  }
  async function video(file, progress) {
    if (!file.type.startsWith('video/')) throw Error('Video file select karein.');
    if (file.size <= 650000) return file;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      throw Error('Is phone par video compression supported nahi. 650 KB se choti video select karein.');
    }
    const source=await videoElement(file),duration=Number(source.duration||0);if (!duration || duration > 120) {URL.revokeObjectURL(source.src);throw Error('Video 2 minutes se choti select karein.');}
    const scale=Math.min(1,720/Math.max(source.videoWidth,source.videoHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.round(source.videoWidth*scale/2)*2);canvas.height=Math.max(2,Math.round(source.videoHeight*scale/2)*2);
    const context=canvas.getContext('2d'),stream=canvas.captureStream(24),captured=source.captureStream?.();captured?.getAudioTracks().forEach(track=>stream.addTrack(track));
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
    if (!mime) {URL.revokeObjectURL(source.src);throw Error('Is phone par video compression supported nahi.');}
    const totalBitrate=Math.floor((610000*8/duration)*.88),audioBitrate=24000,videoBitrate=Math.max(55000,Math.min(520000,totalBitrate-audioBitrate)),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:videoBitrate,audioBitsPerSecond:audioBitrate});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const result=new Promise((resolve,reject)=>{recorder.onerror=()=>reject(Error('Video compression failed'));recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});
    let frame;const draw=()=>{context.drawImage(source,0,0,canvas.width,canvas.height);progress?.(Math.min(.96,source.currentTime/duration));if(!source.ended)frame=requestAnimationFrame(draw);};
    recorder.start(500);await source.play();draw();await new Promise(resolve=>source.onended=resolve);cancelAnimationFrame(frame);if(recorder.state!=='inactive')recorder.stop();const blob=await result;stream.getTracks().forEach(track=>track.stop());URL.revokeObjectURL(source.src);
    if (!blob.size || blob.size >= 700000) throw Error('Video 700 KB se neeche compress nahi hui. Choti ya kam duration video select karein.');
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webm',{type:'video/webm',lastModified:Date.now()});
  }
  async function optimize(file, progress) {return file.type.startsWith('image/') ? image(file) : video(file, progress);}
  window.KT_MEDIA={optimize,image,video,label};
})();
