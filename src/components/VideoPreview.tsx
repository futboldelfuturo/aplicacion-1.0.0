// src/components/VideoPreview.tsx
import React, { useState } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, ActivityIndicator, Image, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

interface VideoPreviewProps {
  videoUrl: string;
  style?: StyleProp<ViewStyle>;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ videoUrl, style }) => {
  const [loading, setLoading] = useState(true);

  // Detectar si es YouTube
  const esYoutube = videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be');
  const youtubeVideoId = esYoutube 
    ? videoUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1]
    : null;

  // URL del thumbnail de YouTube
  const youtubeThumbnail = youtubeVideoId 
    ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`
    : null;

  if (esYoutube && youtubeVideoId) {
    return (
      <View style={[styles.container, style]}>
        {loading && (
          <View style={styles.placeholder}>
            <ActivityIndicator size="large" color="#888" />
          </View>
        )}
        {youtubeThumbnail ? (
          <Image
            source={{ uri: youtubeThumbnail }}
            style={styles.video}
            resizeMode="cover"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
            }}
          />
        ) : (
          <View style={[styles.video, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: '#fff', fontSize: 24 }}>▶</Text>
          </View>
        )}
        {/* Overlay con icono de YouTube */}
        <View style={styles.youtubeOverlay}>
          <View style={styles.youtubeIcon}>
            <Text style={styles.youtubeIconText}>▶</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {loading && (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color="#888" />
        </View>
      )}
      <Video
        source={{ uri: videoUrl }}
        style={styles.video}
        useNativeControls={false}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={false}
        onLoad={() => setLoading(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 180,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  youtubeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  youtubeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  youtubeIconText: {
    color: '#fff',
    fontSize: 24,
    marginLeft: 4,
  },
});

export default VideoPreview;
