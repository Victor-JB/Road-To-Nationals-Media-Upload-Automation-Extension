// utils.js -- just auxiliary functions


/**
* Utility functions for the GymACT Road2Nationals Uploader.
* These functions are used to build the description for the uploaded videos
* and to handle the score input.
*/
export function buildDescription(originalDescription = '') {
    // fall back to blank if user left the box empty
    const scoreLine = scoreInput.value.trim()
        ? `Score: ${scoreInput.value.trim()}\n`
        : '';
  
    return `${scoreLine}${originalDescription}
  
  Uploaded via GymACT Road2Nationals Uploader`;
  }


