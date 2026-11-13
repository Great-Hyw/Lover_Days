package com.wei.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TurnstileResponse {
    private boolean Success;
    private Object ErrorCodes;
}
