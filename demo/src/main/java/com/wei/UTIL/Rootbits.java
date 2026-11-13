package com.wei.UTIL;

import com.wei.pojo.TurnstileResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.List;
@Slf4j
@Component
public class Rootbits {
    @Value("${Cf.SITEVERIFY_URL}")
    private  String SITEVERIFY_URL;
    @Value("${Cf.siteKey}")
    private  String secretKey ;
    private static final RestTemplate restTemplate = new RestTemplate();

    public TurnstileResponse validateToken(String token, String remoteip) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("secret", secretKey);
        params.add("response", token);
        if (remoteip != null) {
            params.add("remoteip", remoteip);
        }

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

        try {
            ResponseEntity<TurnstileResponse> response = restTemplate.postForEntity(SITEVERIFY_URL, request, TurnstileResponse.class);
            return response.getBody();
        } catch (Exception e) {
            log.error( e.toString());
            TurnstileResponse errorResponse = new TurnstileResponse();
            errorResponse.setSuccess(false);
            errorResponse.setErrorCodes(List.of("internal-error"));
            return errorResponse;
        }
    }

}



