package com.wei.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Photo {
    private String key;
    private Integer id;
    private Integer userId;
    private String url;
    private String name;
    private Long size;
    private Integer lastId;
    private LocalDate createdAt;
}
