package com.wei.Service;

import com.wei.pojo.Photo;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface PhotoService {
    Photo upload(MultipartFile file, Integer id);

    Integer delete(Photo key);

    List<Photo> getAll(Integer lastId);
}
