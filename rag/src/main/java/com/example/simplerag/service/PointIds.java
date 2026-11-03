package com.example.simplerag.service;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;

/** 沿用原实验的 UUID v5 命名空间；集合隔离由配置负责。 */
public final class PointIds {
    private static final UUID URL_NAMESPACE = UUID.fromString("6ba7b811-9dad-11d1-80b4-00c04fd430c8");
    private static final UUID POINT_NAMESPACE = uuid5(URL_NAMESPACE, "https://mindpad.smzdm.com/kb/point");

    private PointIds() { }

    public static String forChunk(long documentId, int version, int chunkIndex) {
        return uuid5(POINT_NAMESPACE, documentId + ":" + version + ":" + chunkIndex).toString();
    }

    private static UUID uuid5(UUID namespace, String name) {
        try {
            MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
            byte[] namespaceBytes = ByteBuffer.allocate(16).putLong(namespace.getMostSignificantBits())
                    .putLong(namespace.getLeastSignificantBits()).array();
            sha1.update(namespaceBytes);
            byte[] hash = sha1.digest(name.getBytes(StandardCharsets.UTF_8));
            hash[6] = (byte) ((hash[6] & 0x0f) | 0x50);
            hash[8] = (byte) ((hash[8] & 0x3f) | 0x80);
            ByteBuffer buffer = ByteBuffer.wrap(hash);
            return new UUID(buffer.getLong(), buffer.getLong());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("当前 JDK 不支持 UUID v5 所需的 SHA-1", exception);
        }
    }
}
