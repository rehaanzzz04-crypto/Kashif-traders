import SwiftUI

@main
struct KashifTradersApp: App {
    var body: some Scene {
        WindowGroup { ContentView().ignoresSafeArea(.container, edges: .bottom) }
    }
}

struct ContentView: View {
    var body: some View { ERPWebView() }
}
