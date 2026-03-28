import React from "react";

export default function CallOverlay({ 
  stream, 
  remoteStream, 
  onHangUp, 
  isReceivingCall, 
  callerName, 
  onAnswer, 
  callAccepted, 
  callEnded 
}) {
  return (
    <div className="call-overlay">
      <div className="call-window">
        {/* Local Stream */}
        <div className="local-video-container">
          {stream && (
            <video
              playsInline
              muted
              ref={(ref) => { if(ref) ref.srcObject = stream; }}
              autoPlay
              className="local-video"
            />
          )}
        </div>

        {/* Remote Stream */}
        <div className="remote-video-container">
          {callAccepted && !callEnded ? (
            <video
              playsInline
              ref={(ref) => { if(ref && remoteStream) ref.srcObject = remoteStream; }}
              autoPlay
              className="remote-video"
            />
          ) : (
            <div className="calling-placeholder">
              <div className="pulse-avatar">👤</div>
              <p>{callAccepted ? "Connecting..." : isReceivingCall ? `${callerName} is calling...` : "Ringing..."}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="call-controls">
          {isReceivingCall && !callAccepted ? (
            <button className="call-btn answer" onClick={onAnswer}>✅ Answer</button>
          ) : null}
          <button className="call-btn hangup" onClick={onHangUp}>❌ Hang Up</button>
        </div>
      </div>
    </div>
  );
}
