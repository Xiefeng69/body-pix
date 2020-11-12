import * as bodyPix from '@tensorflow-models/body-pix';
import { setupCamera } from './camera';
import {drawKeypoints, drawSkeleton} from './draw-pos';
import { classifyMotion } from './classifier';
import * as partColorScales from './part_color_scales';

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

const resultEle = document.getElementById('result');
let result = null;

const modelParams = {
    algorithm: 'multi-person-instance',
    estimate: 'partmap',
    camera: null,
    flipHorizontal: true,
    input: {
        architecture: 'MobileNetV1',
        outputStride: 16,
        internalResolution: 'low',
        multiplier: 0.50,
        quantBytes: 2
    },
    multiPersonDecoding: {
        maxDetections: 5,
        scoreThreshold: 0.3,
        nmsRadius: 20,
        numKeypointForMatching: 17,
        refineSteps: 10
    },
    segmentation: {
        segmentationThreshold: 0.7,
        effect: 'mask',
        maskBackground: true,
        opacity: 0.7,
        backgroundBlurAmount: 3,
        maskBlurAmount: 0,
        edgeBlurAmount: 3
    },
    partMap: {
        colorScale: 'rainbow',
        effect: 'partMap',
        segmentationThreshold: 0.5,
        opacity: 0.9,
        blurBodyPartAmount: 3,
        bodyPartEdgeBlurAmount: 3,
    },
    showFps: false
}; 

const executeState = {
    video: null,
    stream: null,
    coreNet: null,
    videoConstraints: {}
}

//加载body-pix模型
async function loadBodyPix(){
    executeState.coreNet = await bodyPix.load({
        architecture: modelParams.input.architecture,
        outputStride: modelParams.input.outputStride,
        multiplier: modelParams.input.multiplier,
        quantBytes: modelParams.input.quantBytes
    });
}

// 加载视频
async function loadVideo(cameraLabel){
    try {
        executeState.video = await setupCamera(cameraLabel);
    } catch(error) {
        // TODO 界面变化
        throw error;
    }
    executeState.video.play();
}

async function estimateSegmentation() {
    let multiPersonSegmentation = null;
    switch (modelParams.algorithm) {
        case 'multi-person-instance':
        return await executeState.coreNet.segmentMultiPerson(executeState.video, {
            internalResolution: modelParams.input.internalResolution,
            segmentationThreshold: modelParams.segmentation.segmentationThreshold,
            maxDetections: modelParams.multiPersonDecoding.maxDetections,
            scoreThreshold: modelParams.multiPersonDecoding.scoreThreshold,
            nmsRadius: modelParams.multiPersonDecoding.nmsRadius,
            numKeypointForMatching:
                modelParams.multiPersonDecoding.numKeypointForMatching,
            refineSteps: modelParams.multiPersonDecoding.refineSteps
        });
        case 'person':
        return await executeState.coreNet.segmentPerson(executeState.video, {
            internalResolution: modelParams.input.internalResolution,
            segmentationThreshold: modelParams.segmentation.segmentationThreshold,
            maxDetections: modelParams.multiPersonDecoding.maxDetections,
            scoreThreshold: modelParams.multiPersonDecoding.scoreThreshold,
            nmsRadius: modelParams.multiPersonDecoding.nmsRadius,
        });
        default:
            break;
    };
    return multiPersonSegmentation;
}

async function estimatePartSegmentation() {
    switch (modelParams.algorithm) {
        case 'multi-person-instance':
        return await executeState.coreNet.segmentMultiPersonParts(executeState.video, {
            internalResolution: modelParams.input.internalResolution,
            segmentationThreshold: modelParams.segmentation.segmentationThreshold,
            maxDetections: modelParams.multiPersonDecoding.maxDetections,
            scoreThreshold: modelParams.multiPersonDecoding.scoreThreshold,
            nmsRadius: modelParams.multiPersonDecoding.nmsRadius,
            numKeypointForMatching:
                modelParams.multiPersonDecoding.numKeypointForMatching,
            refineSteps: modelParams.multiPersonDecoding.refineSteps
        });
        case 'person':
        return await executeState.coreNet.segmentPersonParts(executeState.video, {
            internalResolution: modelParams.input.internalResolution,
            segmentationThreshold: modelParams.segmentation.segmentationThreshold,
            maxDetections: modelParams.multiPersonDecoding.maxDetections,
            scoreThreshold: modelParams.multiPersonDecoding.scoreThreshold,
            nmsRadius: modelParams.multiPersonDecoding.nmsRadius,
        });
        default:
            break;
    };
    return multiPersonPartSegmentation;
}

function drawPoses(personOrPersonPartSegmentation, flipHorizontally, ctx) {
    if (Array.isArray(personOrPersonPartSegmentation)) {
        personOrPersonPartSegmentation.forEach(personSegmentation => {
            let pose = personSegmentation.pose;
            if (flipHorizontally) {
                pose = bodyPix.flipPoseHorizontal(pose, personSegmentation.width);
            }
            drawKeypoints(pose.keypoints, 0.1, ctx);
            drawSkeleton(pose.keypoints, 0.1, ctx);
            result = classifyMotion(pose.keypoints);
            resultEle.innerText = `分类结果为: ${result}`;
        });
    } else {
        personOrPersonPartSegmentation.allPoses.forEach(pose => {
            if (flipHorizontally) {
                pose = bodyPix.flipPoseHorizontal(
                    pose, personOrPersonPartSegmentation.width);
            }
            drawKeypoints(pose.keypoints, 0.1, ctx);
            drawSkeleton(pose.keypoints, 0.1, ctx);
            result = classifyMotion(pose.keypoints);
            resultEle.innerText = `分类结果为: ${result}`;
        })
    }
}

// 实时预测身体动作
function predictBodyMotionInRealTime() {
    const canvas = document.getElementById('output');
  
    async function bodyPredictionFrame() {
  
      const flipHorizontally = modelParams.flipHorizontal;
  
      switch (modelParams.estimate) {
        case 'segmentation':
          const multiPersonSegmentation = await estimateSegmentation();
          switch (modelParams.segmentation.effect) {
            case 'mask':
              const ctx = canvas.getContext('2d');
              const foregroundColor = {r: 255, g: 255, b: 255, a: 255};
              const backgroundColor = {r: 0, g: 0, b: 0, a: 255};
              const mask = bodyPix.toMask(
                  multiPersonSegmentation, foregroundColor, backgroundColor,
                  true);
  
              bodyPix.drawMask(
                  canvas, executeState.video, mask, modelParams.segmentation.opacity,
                  modelParams.segmentation.maskBlurAmount, flipHorizontally);
              drawPoses(multiPersonSegmentation, flipHorizontally, ctx);
              break;
            case 'bokeh':
              bodyPix.drawBokehEffect(
                  canvas, executeState.video, multiPersonSegmentation,
                  +modelParams.segmentation.backgroundBlurAmount,
                  modelParams.segmentation.edgeBlurAmount, flipHorizontally);
              break;
          }
  
          break;
        case 'partmap':
            const ctx = canvas.getContext('2d');
            const multiPersonPartSegmentation = await estimatePartSegmentation();
            const coloredPartImageData = bodyPix.toColoredPartMask(
                multiPersonPartSegmentation,
                partColorScales[modelParams.partMap.colorScale]);
  
            const maskBlurAmount = 0;
            switch (modelParams.partMap.effect) {
                case 'pixelation':
                const pixelCellWidth = 10.0;
    
                bodyPix.drawPixelatedMask(
                    canvas, executeState.video, coloredPartImageData,
                    modelParams.partMap.opacity, maskBlurAmount, flipHorizontally,
                    pixelCellWidth);
                break;
                case 'partMap':
                bodyPix.drawMask(
                    canvas, executeState.video, coloredPartImageData, modelParams.opacity,
                    maskBlurAmount, flipHorizontally);
                break;
                case 'blurBodyPart':
                const blurBodyPartIds = [0, 1];
                bodyPix.blurBodyPart(
                    canvas, executeState.video, multiPersonPartSegmentation,
                    blurBodyPartIds, modelParams.partMap.blurBodyPartAmount,
                    modelParams.partMap.edgeBlurAmount, flipHorizontally);
            }
            drawPoses(multiPersonPartSegmentation, flipHorizontally, ctx);
            break;
        default:
            break;
      }
  
      requestAnimationFrame(bodyPredictionFrame);
    }
  
    bodyPredictionFrame();
  }

async function bindPage(){
    console.log('say hi');
    await loadBodyPix();
    // TODO 界面变化
    console.log('hi');
    await loadVideo(modelParams.camera);
    console.log('hello');
    predictBodyMotionInRealTime();
}

export function beginBodyPix(init){
    // 1. 初始化模型参数
    // 2. 初始化模型
    bindPage();
}

bindPage();
