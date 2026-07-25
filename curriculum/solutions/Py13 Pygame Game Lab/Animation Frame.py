def animation_frame(elapsed_ms, frame_duration_ms, frame_count):
    if frame_duration_ms <= 0 or frame_count <= 0:
        return 0
    return (elapsed_ms // frame_duration_ms) % frame_count
