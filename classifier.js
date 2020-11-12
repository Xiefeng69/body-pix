function forward(keypoint, basis) {
    return {
        confidence: Math.abs(keypoint.leftWrist.position.y - keypoint.leftShoulder.position.y) / basis
    }
}

function backward(keypoint, basis) {
    return {
        confidence: Math.abs(keypoint.rightWrist.position.y - keypoint.rightShoulder.position.y) / basis
    }
}

function left(keypoint, basis) {
    return {
        confidence: Math.abs(keypoint.lefttWrist.position.x - keypoint.leftShoulder.position.x) / basis
    }
}

function right(keypoint, basis) {
    return {
        confidence: Math.abs(keypoint.rightWrist.position.x - keypoint.rightShoulder.position.x) / basis
    }
}

export function classifyMotion(rawKeypoints) {
    const keypoints = rawKeypoints.reduce((p, c) => {
        p[c.part] = {
            score: c.score,
            position: { ...c.position }
        }
        return p
    }, {})
    const basis = Math.abs(keypoints.rightShoulder.position.x - keypoints.leftShoulder.position.x)
    return {
        forward: forward(keypoints, basis),
        backward: backward(keypoints, basis),
        left: left(keypoints, basis),
        right: right(keypoints, basis)
    };
}