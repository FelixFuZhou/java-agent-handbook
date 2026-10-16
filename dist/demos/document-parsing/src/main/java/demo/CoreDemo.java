package demo;

public class CoreDemo {
  public static void main(String[] args) throws Exception {
    var document = Documents.parse();
    System.out.println("documentId=" + document.documentId() + " version=" + document.version());
    for (var chunk : Documents.chunks(document, 80, 16))
      System.out.println("[" + chunk.startCodePoint() + "," + chunk.endCodePoint() + ") " + chunk.text());
  }
}
