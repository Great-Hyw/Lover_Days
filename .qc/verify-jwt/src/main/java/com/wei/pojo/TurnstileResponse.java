package com.wei.pojo;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TurnstileResponse {
    private boolean success;
    private LocalDateTime challenge_ts;
    private String hostname;
    @JsonProperty("error-codes")
    private Object errorCodes;

    private String action;

    private String  cdata;

    private Object metadata;



}
