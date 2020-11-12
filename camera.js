// 判断是否为移动端
function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}

function isiOS() {
    return /ipad|iphone|ipod/i.test(navigator.userAgent);
}

function isMobile() {
    return isAndroid() || isiOS();
}

// 获取所有的videoInput设备
async function getVideoInputs() {
    // 检查是否支持mediaDevices方法
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.log('enumerateDevices() not supported.');
        return [];
    }

    // obtains an array of media input and output devices available
    const devices = await navigator.mediaDevices.enumerateDevices();
    // filt the video input device
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    return videoDevices;
}

// 通过cameraLabel获得设备的deviceId
async function getDeviceIdForLabel(cameraLabel) {
    const videoInputs = await getVideoInputs();

    for (let i = 0; i < videoInputs.length; i++) {
        const videoInput = videoInputs[i];
        if (videoInput.label === cameraLabel) {
            return videoInput.deviceId;
        }
    }

    return null;
}

// 获取摄像机模式
/*
    当为移动设备时，facingMode将决定使用前置摄像头or后置摄像头
    facingMode: "user" => use the front camera
    facingMode: { exact: "environment" } => use the rear camera
*/
function getFacingMode(cameraLabel) {
    if (!cameraLabel) {
        return 'user';
    }
    if (cameraLabel.toLowerCase().includes('back')) {
        return 'environment';
    } else {
        return 'user';
    }
}

// 获取getUserMedia传入的constraints
async function getConstraints(cameraLabel) {
    let deviceId, facingMode;
    if (cameraLabel) {
        deviceId = await getDeviceIdForLabel(cameraLabel);
        facingMode = isMobile() ? getFacingMode(cameraLabel) : null;
    }

    return {deviceId, facingMode};
}

export async function setupCamera(cameraLabel) {
    console.log(cameraLabel);
    console.log('set up camera');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser API navigator.mediaDevices.getUserMedia not availabl')
    }

    const videoEle = document.getElementsByTagName('video')[0];

    const videoConstrints = await getConstraints(cameraLabel);
    videoEle.srcObject = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstrints
    });

    return new Promise((resolve) => {
        // HTMLMediaElement:loadedmetadata event
        // loadedmetadata事件在metadata加载完成时触发
        videoEle.onloadedmetadata = () => {
            videoEle.width = videoEle.videoWidth;
            videoEle.height = videoEle.videoHeight;
            resolve(videoEle);
        }
    })
}