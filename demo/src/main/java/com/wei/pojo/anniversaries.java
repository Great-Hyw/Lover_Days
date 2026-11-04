package com.wei.pojo;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class anniversaries {
    private Integer id ;
    private Integer userId;
    private  String title;
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate date;
    private String type;
    private String icon;
    private  String color;
    private Boolean isYearly;
    private String note;
    private String bgImage;
    private LocalDate createdAt;
    private LocalDate updatedAt;

}
