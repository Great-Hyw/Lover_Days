package com.wei.UTIL;

import com.aliyun.oss.*;
import com.aliyun.oss.common.auth.CredentialsProviderFactory;
import com.aliyun.oss.common.auth.EnvironmentVariableCredentialsProvider;
import com.aliyun.oss.common.comm.SignVersion;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PutObjectRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

@Component
public class OssUtil {
    // 最大8MB
    @Value("${aliyun.MAX_SIZE}")
    private long MAX_SIZE;

    // 允许的图片类型
    public static String[] ALLOW_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"};

    // 日志对象，替换printStackTrace
    private static final Logger log = LoggerFactory.getLogger(OssUtil.class);

    // OSS常量
    @Value("${aliyun.ENDPOINT}")
    private String ENDPOINT = " https://oss-cn-beijing.aliyuncs.com/ ";

    @Value("${aliyun.BUCKET_NAME}")
    private String BUCKET_NAME = "wei-p";

    @Value("${aliyun.REGION}")
    private String REGION = "cn-beijing";

    /*
     * 上传图片，返回 OSS的key和url
     * @param file 前端MultipartFile
     * @return String[] 0:url 1:key
     */
    public String[] uploadImage(MultipartFile file) throws ClientException {
        // ==========后端复验 大小校验==========
        log.info("文件大小"+file.getSize()+"规定的"+MAX_SIZE);
        if (file.getSize() > MAX_SIZE) {
            throw new RuntimeException("文件不能超过8MB");
        }

        // ==========后端复验 文件类型==========
        boolean typeOk = false;
        for (String mime : ALLOW_MIME) {
            if (mime.equals(file.getContentType())) {//获取文件类型
                typeOk = true;
                break;
            }
        }
        if (!typeOk) {
            throw new RuntimeException("只允许 jpeg/png/webp/gif图片");
        }

        OSS ossClient = null;
        InputStream inputStream = null;
        try {
            // 这里会抛出ClientException，现在被try捕获
            EnvironmentVariableCredentialsProvider credentialsProvider = CredentialsProviderFactory.newEnvironmentVariableCredentialsProvider();//获取环境变量;
            ClientBuilderConfiguration clientBuilderConfiguration = new ClientBuilderConfiguration();
            clientBuilderConfiguration.setSignatureVersion(SignVersion.V4);
            ossClient = OSSClientBuilder.create().endpoint(ENDPOINT).credentialsProvider(credentialsProvider).clientConfiguration(clientBuilderConfiguration).region(REGION).build();

            // =========修复：判空，防止getOriginalFilename为null报错========
            String originalName = file.getOriginalFilename();
            if (originalName == null || originalName.isBlank()) {
                throw new RuntimeException("文件名称为空");
            }
            String objectName = generateOssObjectName(originalName);
            inputStream = file.getInputStream();

            /* 让浏览器直接浏览图片而不是下载 */
            ObjectMetadata meta = new ObjectMetadata();
            meta.setContentType(file.getContentType());
            PutObjectRequest putObjectRequest = new PutObjectRequest(BUCKET_NAME, objectName, inputStream, meta);
            ossClient.putObject(putObjectRequest);

            String url = "https://" + BUCKET_NAME + "." + ENDPOINT.replace("https://", "") + "/" + objectName;
            return new String[]{url, objectName};
        } catch (OSSException oe) {
            log.error("OSS服务异常", oe);
            throw new RuntimeException("OSS服务异常: " + oe.getErrorMessage());
        } catch (IOException e) {
            log.error("读取前端文件失败", e);
            throw new RuntimeException("读取前端文件失败: " + e.getMessage());
        } catch (com.aliyuncs.exceptions.ClientException e) {
            throw new RuntimeException(e);
        } finally {
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (IOException e) {
                    log.error("关闭流异常", e);
                }
            }
            if (ossClient != null) {
                ossClient.shutdown();
            }
        }
    }

    /*
     * 生成oss key，示例：anniversary/u-001/xxxx.png
     */
    private String generateOssObjectName(String originalFilename) {
        String suffix = originalFilename.substring(originalFilename.lastIndexOf("."));
        return "anniversary/u-001/" + UUID.randomUUID() + suffix;
    }

    public void delete(String key) throws Exception {
        String objectName=key;
        // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
        EnvironmentVariableCredentialsProvider credentialsProvider = CredentialsProviderFactory.newEnvironmentVariableCredentialsProvider();
        // 创建OSSClient实例。
        // 当OSSClient实例不再使用时，调用shutdown方法以释放资源。
        ClientBuilderConfiguration clientBuilderConfiguration = new ClientBuilderConfiguration();
        clientBuilderConfiguration.setSignatureVersion(SignVersion.V4);
        OSS ossClient = OSSClientBuilder.create().endpoint(ENDPOINT).credentialsProvider(credentialsProvider).clientConfiguration(clientBuilderConfiguration).region( REGION).build();
        try {
            // 删除文件或目录。如果要删除目录，目录必须为空。
            ossClient.deleteObject(BUCKET_NAME, objectName);
        } catch (OSSException oe) {
            System.out.println("Caught an OSSException, which means your request made it to OSS, " +
                    "but was rejected with an error response for some reason.");
            System.out.println("Error Message:" + oe.getErrorMessage());
            System.out.println("Error Code:" + oe.getErrorCode());
            System.out.println("Request ID:" + oe.getRequestId());
            System.out.println("Host ID:" + oe.getHostId());
        } catch (ClientException ce) {
            System.out.println("Caught an ClientException, which means the client encountered " +
                    "a serious internal problem while trying to communicate with OSS, " +
                    "such as not being able to access the network.");
            System.out.println("Error Message:" + ce.getMessage());
        } finally {
            if (ossClient != null) {
                ossClient.shutdown();
            }
        }
    }
}
