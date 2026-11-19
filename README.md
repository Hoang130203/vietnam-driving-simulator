# Tay Lái Việt

Tay Lái Việt là trình mô phỏng lái xe 3D trên trình duyệt. Bạn có thể lái tự do qua mạng đường Việt Nam, đua trên đường kín hoặc luyện các bài sát hạch hạng B.

| Chế độ | Nội dung |
| --- | --- |
| Xuyên Việt | Chọn điểm xuất phát, lái tự do hoặc đua trên mạng đường dựng từ OpenStreetMap. |
| Cúp Bánh Mì | Đua trên hai cung đường kín Ven sông và Đèo trà. |
| Sân tập và thi thử | Ôn câu hỏi, làm đề lý thuyết, tập sa hình, tập đường trường và lái trên phố. |

Các bài tập và điểm số phục vụ luyện tập. Khi chuẩn bị thi thật, hãy đối chiếu với tài liệu của cơ quan sát hạch.

## Chạy trên máy

Cần Git, Python 3 và trình duyệt hỗ trợ WebGL cho các chế độ 3D. Trang được phục vụ trực tiếp từ `dist/`.

```sh
git clone https://github.com/tang-vu/vietnam-driving-simulator.git
cd vietnam-driving-simulator
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

- [Xuyên Việt](http://127.0.0.1:8000/)
- [Cúp Bánh Mì](http://127.0.0.1:8000/cup.html)
- [Sân tập và thi thử](http://127.0.0.1:8000/hall.html)

Ở Xuyên Việt, dùng **W/S** để ga, phanh và lùi, **A/D** để đánh lái, **Shift** để dùng nitro và **U** để đặt xe về đường. Trên điện thoại, dùng các nút cảm ứng của chế độ đang chơi.

## Đóng góp và báo lỗi

- [Hướng dẫn đóng góp](CONTRIBUTING.md)
- [Quy tắc ứng xử](CODE_OF_CONDUCT.md)
- [Báo lỗi hoặc đề xuất tính năng](https://github.com/tang-vu/vietnam-driving-simulator/issues/new/choose)
- [Báo cáo lỗ hổng bảo mật](SECURITY.md)
- [Khả năng tiếp cận](ACCESSIBILITY.md)

## Quyền sử dụng và ghi công

Tang Vu bảo lưu quyền đối với phần mã nguồn và nội dung gốc thuộc sở hữu của mình. Xem [thông báo bản quyền](LICENSE) trước khi tái sử dụng hoặc phân phối.

- Dữ liệu đường và mặt nước dựa trên OpenStreetMap theo ODbL 1.0. Xem [ghi công dữ liệu đường](dist/vn-roads/CREDITS.txt) và [điều khoản OpenStreetMap](https://www.openstreetmap.org/copyright).
- Three.js và các tiện ích đi kèm theo [giấy phép MIT của Three.js](dist/THREE-LICENSE.txt).
- Nguồn và điều khoản của mô hình xe, ảnh và texture được ghi trong [ghi công cảnh quan](dist/streetscape/CREDITS.txt), [ghi công xe đua](dist/streetscape/race-car-credits.txt) và [ghi công bổ sung](dist/streetscape/vehicle-pack-credits.txt).
- Câu hỏi và hình minh họa sát hạch có nguồn từ [bộ 600 câu hỏi của Cục CSGT](https://csgt.bocongan.gov.vn/index.php/van-ban/bo-600-cau-hoi-dung-cho-sat-hach-lai-xe-co-gioi-duong-bo). Khi dùng lại, hãy kiểm tra điều khoản của nguồn.
