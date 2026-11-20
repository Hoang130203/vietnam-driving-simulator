# ViVu3D

[Chơi ViVu3D trên web](https://vivu3d.com/)

ViVu3D là trình mô phỏng lái xe 3D trên trình duyệt. Bạn có thể lái tự do qua mạng đường Việt Nam, đua trên đường kín hoặc luyện các bài sát hạch hạng B.

Ở màn **Xuyên Việt**, chọn Hà Nội (Hồ Gươm), Tam Chúc, Huế (Ngọ Môn), Kon Tum (nhà rông Kon Klor), TP.HCM (chợ Bến Thành) hoặc Cần Thơ (chợ nổi Cái Răng) để xem cảnh rồi bấm **Cầm lái**. Khi mở trang chính, game tiếp tục hành trình đã lưu. Nếu chưa có hành trình, điểm giới thiệu thay đổi theo ngày.

| Chế độ | Nội dung |
| --- | --- |
| Xuyên Việt | Lái theo mạng đường OpenStreetMap và thời tiết địa phương. Khi tạm dừng, có thể gửi quãng đường của lượt lái lên bảng xếp hạng. |
| Cúp Bánh Mì | Đua tuyến Ven sông, Đèo trà và các chặng đèo Việt Nam. Mỗi chặng có bảng thành tích riêng theo thời gian, gồm cả giây phạt. |
| Sân tập và thi thử | Ôn câu hỏi, làm đề lý thuyết, tập sa hình, tập đường trường và lái trên phố. |

Các bài tập và điểm số phục vụ luyện tập. Khi chuẩn bị thi thật, hãy đối chiếu với tài liệu của cơ quan sát hạch.

## Chạy trên máy

Cần Git, Python 3 và trình duyệt hỗ trợ WebGL cho các chế độ 3D. Lệnh bên dưới phục vụ trò chơi từ `dist/`. Để gửi điểm hoặc xem bảng xếp hạng chung, mở bản web ở đầu trang.

```sh
git clone https://github.com/tang-vu/vietnam-driving-simulator.git
cd vietnam-driving-simulator
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

- [Xuyên Việt](http://127.0.0.1:8000/)
- [Cúp Bánh Mì](http://127.0.0.1:8000/cup.html)
- [Sân tập và thi thử](http://127.0.0.1:8000/hall.html)

Các chế độ lái 3D mặc định dùng đồ họa **Tự động**. Game chọn mức ban đầu theo thông tin phần cứng mà trình duyệt cung cấp, hạ chất lượng khi khung hình chậm kéo dài và tăng lại sau một khoảng chạy ổn định. Để tự chọn, mở **Bố trí buồng lái → Chất lượng đồ họa** ở Xuyên Việt, Cúp Bánh Mì hoặc Sân tập. Các mức **Thấp**, **Vừa** và **Cao** được lưu trên trình duyệt và áp dụng cho các chế độ lái.

Ở Xuyên Việt, dùng **W/S** để ga, phanh và lùi, **A/D** để đánh lái, **Shift** để dùng nitro và **U** để đặt xe về đường. Ở ngã rẽ, bảng chỉ hướng ghi tên đường hoặc địa danh có lối ô tô tới. Nhấn **M** hoặc chạm bản đồ nhỏ để xem đường quanh xe, kéo để xem xung quanh và dùng **+ / −** để đổi tỷ lệ. Nhấn **M** hoặc **Esc** để lái tiếp. Trên điện thoại, dùng các nút cảm ứng của chế độ đang chơi.

Trong **Lộ trình → Tự chọn**, chọn điểm đi và điểm đến trong Atlas rồi bấm **Tìm đường**. Bạn có thể tìm tên đường, địa danh, nhập tọa độ hoặc chạm bản đồ. Khi game hiện chiều dài hành trình, bấm **Cầm lái** và theo vệt xanh cùng chỉ dẫn trước giao lộ. Game lưu vị trí và lộ trình tự chọn trên trình duyệt để bạn có thể lái tiếp. Nếu hai điểm thuộc các mạng đường ô tô tách rời, hãy thử điểm khác. [Lập lộ trình](https://vivu3d.com/?plan=custom).

Trong **Lộ trình → Tuyến nổi bật**, mỗi tuyến có đường chạy cố định và bảng xếp hạng riêng. Chọn tuyến để xem quãng đường hoặc bảng hạng. Khi tới đích, gửi biệt danh để ghi kỷ lục. Máy chủ chốt thời gian từ lúc xuất phát đến khi tới đích, gồm cả lúc tạm dừng. Các lượt tự chọn chỉ hiển thị kết quả của chuyến đi đó. [Xem các tuyến nổi bật](https://vivu3d.com/?plan=featured) · [Mở tuyến Ba Sao → Tam Chúc](https://vivu3d.com/?drive=ba-sao-tam-chuc).

Trong Xuyên Việt, mở **Danh lam 3D** ở mục điểm xuất phát để chọn địa danh qua hình xem trước. Khi tới gần, nhấn **Ngắm địa danh 3D** để xoay, chỉnh khoảng cách hoặc mở ảnh đối chiếu. Trong **Quần thể Tam Chúc**, chọn góc toàn cảnh hoặc một trong tám công trình để ngắm từ gần. Nút **Trở lại xe** đưa góc nhìn về nơi đã dừng. [Ảnh và tư liệu đối chiếu](dist/landmark-references.txt).

Trong bản đồ điểm xuất phát, gõ tên đường, số nhà hoặc địa danh, có dấu hoặc không dấu. Thêm tên tỉnh hoặc quận để phân biệt những nơi trùng tên. Thử **48 Hàng Ngang, Hà Nội**, **QL21** hoặc **cây xăng gần đây**. Khi chọn kết quả, bản đồ đánh dấu vị trí để bạn bắt đầu lái. [Tìm Ba Sao trên trang game](https://vivu3d.com/?search=Ba%20Sao) · [Nguồn dữ liệu tìm kiếm](dist/vn-search/CREDITS.txt).

Chọn **Ba Sao · Quốc lộ 21** rồi lái theo đường Điện Biên Phủ về phía Khả Phong để đi từ khu dân cư ra chân núi. Khi chạy trên máy, có thể [mở ngay Ba Sao](http://127.0.0.1:8000/?drive=ba-sao). Biển giao thông báo trước khúc cua, giao lộ và cho biết chiều được phép đi. Chợ, trường học, trạm xăng, quán cà phê và bệnh viện có ký hiệu trên bản đồ.

Game tải cảnh theo vị trí xe. Dữ liệu mặt bằng nhà OSM trên toàn quốc được đóng gói sẵn. Google Open Buildings bổ sung công trình từ ảnh vệ tinh qua mạng, với dữ liệu lưu sẵn quanh 10 thành phố, Tam Chúc và hành lang Ba Sao. Game ưu tiên chiều cao hoặc số tầng OSM, sau đó đến chiều cao vệ tinh ước tính. Mặt tiền và mái hiên được dựng trong game. [Nguồn nhà OSM](dist/vn-osm-buildings/CREDITS.txt) · [Nguồn nhà và chiều cao vệ tinh](dist/vn-structures/CREDITS.txt).

Dân cư WorldPop, loại đường, địa điểm lân cận và giờ Việt Nam điều chỉnh số xe và người đi bộ. Lớp phủ ESA WorldCover phân bố đồng ruộng, rừng, đất xây dựng và mặt nước. [Nguồn dân cư và lớp phủ](dist/vn-environment/CREDITS.txt) · [Nguồn địa điểm](dist/vn-amenities/CREDITS.txt).

Xuyên Việt tải dữ liệu giao thông theo vị trí xe trên mạng đường toàn quốc. Khi OSM có thông tin, bảng lái hiện số làn, tốc độ giới hạn theo chiều và khoảng cách tới đèn hoặc lối sang đường. Vạch phân làn và bề rộng đường dùng các thông số đã lập bản đồ. Xe lưu thông tuân theo hướng rẽ được phép và dừng trước đèn đỏ. Vị trí đèn lấy từ OSM, còn chu kỳ đèn do game mô phỏng. [Độ phủ theo từng thuộc tính](dist/vn-traffic/index.json) · [Nguồn và phạm vi dữ liệu giao thông](dist/vn-traffic/CREDITS.txt).

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
