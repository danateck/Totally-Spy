from collections import defaultdict
from typing import Dict, List, Optional, Tuple
import time
from dataclasses import dataclass
from .data_type_recognition import classify_text

@dataclass
class SessionData:
    start_time: float
    end_time: Optional[float] = None
    data_counts: Dict[str, Dict[str, int]] = None  # type -> value -> count
    best_frame_base64: Optional[str] = None
    location: Optional[Tuple[float, float]] = None
    total_frames: int = 0
    best_frame_score: float = 0.0

class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, SessionData] = {}  # user_id -> session_data
        
    def start_session(self, user_id: str) -> None:
        """Start a new session for a user"""
        self.active_sessions[user_id] = SessionData(
            start_time=time.time(),
            data_counts=defaultdict(lambda: defaultdict(int))
        )
        
    def end_session(self, user_id: str) -> Optional[Dict]:
        """End a session and return the analyzed results"""
        try:
            if user_id not in self.active_sessions:
                return None
            
            session = self.active_sessions[user_id]
            session.end_time = time.time()
            
            results = self._analyze_session_data(session)
            
            has_meaningful_data = False
            
            if results["detected_data"]:
                has_meaningful_data = True
            
            if session.best_frame_base64:
                has_meaningful_data = True
            
            if not has_meaningful_data:
                del self.active_sessions[user_id]
                return None
            
            formatted_data = []
            
            for data_type, value_counts in session.data_counts.items():
                if data_type == "POTENTIALLY_SENSITIVE":
                    for value, count in value_counts.items():
                        if count > 1:
                            formatted_data.append((value, data_type))
                else:
                    if value_counts:
                        most_frequent = max(value_counts.items(), key=lambda x: x[1])
                        if most_frequent[1] > 1:
                            formatted_data.append((most_frequent[0], data_type))
            
            if not formatted_data and not session.best_frame_base64:
                del self.active_sessions[user_id]
                return None
            
            formatted_string = '\n'.join(f"{label}:{value}" for value, label in formatted_data)
            
            from database.database_handler import insert_scan, get_user_name
            username = get_user_name(int(user_id)) if user_id.isdigit() else user_id
            scan_id = insert_scan(
                username,
                formatted_string,
                best_frame_base64=session.best_frame_base64,
                latitude=session.location[0] if session.location else None,
                longitude=session.location[1] if session.location else None
            )
            
            if scan_id:
                results["scan_id"] = scan_id
            
            del self.active_sessions[user_id]
            
            return results
            
        except Exception as e:
            return None
        
    def add_frame_data(self, user_id: str, text: str, best_frame_base64: Optional[str] = None, 
                      location: Optional[Tuple[float, float]] = None, frame_score: float = 0.0) -> Dict:
        """Add data from a single frame to the session and return current best results"""
        if user_id not in self.active_sessions:
            self.start_session(user_id)
            
        session = self.active_sessions[user_id]
        session.total_frames += 1
        
        if best_frame_base64 and frame_score > session.best_frame_score:
            session.best_frame_base64 = best_frame_base64
            session.best_frame_score = frame_score
            
        if location:
            session.location = location
            
        detected_data = classify_text(text)
        otp_value = None
        for value, data_type in detected_data:
            session.data_counts[data_type][value] += 1
            if data_type == "OTP":
                otp_value = value
        
        results = self._analyze_session_data(session)
        
        if otp_value and "OTP" in session.data_counts:
            otp_counts = session.data_counts["OTP"]
            if otp_value == max(otp_counts.items(), key=lambda x: x[1])[0]:
                results["otp_found"] = otp_value
                
        return results
            
    def _analyze_session_data(self, session: SessionData) -> Dict:
        """Analyze the collected data to find the most frequent items"""
        results = {
            "session_duration": time.time() - session.start_time,
            "total_frames": session.total_frames,
            "best_frame": session.best_frame_base64,
            "location": session.location,
            "detected_data": {},
            "confidence_scores": {},
            "all_detected": {}  # Include all detected items with their counts
        }
        
        for data_type, value_counts in session.data_counts.items():
            if not value_counts:
                continue
                
            sorted_items = sorted(value_counts.items(), key=lambda x: x[1], reverse=True)
            
            results["all_detected"][data_type] = [
                {"value": value, "count": count}
                for value, count in sorted_items
            ]

            most_frequent = sorted_items[0][0]
            count = value_counts[most_frequent]
            
            total_count = sum(value_counts.values())
            confidence = int((count / total_count) * 100) if total_count > 0 else 0
            
            if count > 1:
                results["detected_data"][data_type] = most_frequent
                results["confidence_scores"][data_type] = confidence
                
        return results
        
    def get_session_status(self, user_id: str) -> Optional[Dict]:
        """Get the current status of a session without ending it"""
        
        if user_id not in self.active_sessions:
            return None
            
        session = self.active_sessions[user_id]
        return self._analyze_session_data(session)