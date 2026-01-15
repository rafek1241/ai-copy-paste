// AI Context Collector - Finder Sync Extension
// This is a Finder Sync Extension that adds context menu support for macOS Finder

#import <FinderSync/FinderSync.h>
#import <Cocoa/Cocoa.h>

@interface AIContextCollectorFinderSync : FIFinderSync
@end

@implementation AIContextCollectorFinderSync

- (instancetype)init {
    self = [super init];
    if (self) {
        NSLog(@"AIContextCollectorFinderSync initialized");
        
        // Register for monitoring the entire filesystem
        // In production, you might want to be more selective
        [FIFinderSyncController defaultController].directoryURLs = [NSSet setWithObject:[NSURL fileURLWithPath:@"/"]];
    }
    return self;
}

#pragma mark - Menu and Toolbar Item Support

- (NSString *)toolbarItemName {
    return @"AI Context Collector";
}

- (NSString *)toolbarItemToolTip {
    return @"Send to AI Context Collector";
}

- (NSImage *)toolbarItemImage {
    // Return a toolbar icon
    // You should replace this with your app's icon
    return [NSImage imageNamed:NSImageNameActionTemplate];
}

- (NSMenu *)menuForMenuKind:(FIMenuKind)menuKind {
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    
    if (menuKind == FIMenuKindContextualMenuForItems) {
        // Context menu for selected files/folders
        NSMenuItem *menuItem = [[NSMenuItem alloc] initWithTitle:@"Send to AI Context Collector"
                                                          action:@selector(sendToAIContextCollector:)
                                                   keyEquivalent:@""];
        menuItem.target = self;
        [menu addItem:menuItem];
    }
    
    return menu;
}

#pragma mark - Actions

- (IBAction)sendToAIContextCollector:(id)sender {
    // Get selected items
    FIFinderSyncController *syncController = [FIFinderSyncController defaultController];
    NSArray<NSURL *> *selectedItems = [syncController selectedItemURLs];
    
    if (selectedItems.count == 0) {
        // If no items selected, use the current directory
        NSURL *targetURL = [syncController targetedURL];
        if (targetURL) {
            selectedItems = @[targetURL];
        }
    }
    
    if (selectedItems.count > 0) {
        [self openAIContextCollectorWithURLs:selectedItems];
    }
}

- (void)openAIContextCollectorWithURLs:(NSArray<NSURL *> *)urls {
    // Get the main application bundle identifier
    NSString *appBundleIdentifier = @"com.aicontextcollector.app";
    
    // Try to find the application
    NSURL *appURL = [[NSWorkspace sharedWorkspace] URLForApplicationWithBundleIdentifier:appBundleIdentifier];
    
    if (!appURL) {
        // Fallback: Try common installation locations
        NSString *appPath = @"/Applications/AI Context Collector.app";
        appURL = [NSURL fileURLWithPath:appPath];
        
        if (![[NSFileManager defaultManager] fileExistsAtPath:appPath]) {
            NSLog(@"Error: AI Context Collector app not found");
            [self showErrorAlert:@"AI Context Collector app not found. Please make sure it's installed in /Applications/"];
            return;
        }
    }
    
    // Launch the application with the selected files
    NSWorkspaceOpenConfiguration *config = [NSWorkspaceOpenConfiguration configuration];
    
    [[NSWorkspace sharedWorkspace] openURLs:urls
                   withApplicationAtURL:appURL
                              configuration:config
                          completionHandler:^(NSRunningApplication *app, NSError *error) {
        if (error) {
            NSLog(@"Error launching AI Context Collector: %@", error.localizedDescription);
            dispatch_async(dispatch_get_main_queue(), ^{
                [self showErrorAlert:[NSString stringWithFormat:@"Failed to launch AI Context Collector: %@", error.localizedDescription]];
            });
        } else {
            NSLog(@"Successfully launched AI Context Collector with %lu items", (unsigned long)urls.count);
        }
    }];
}

- (void)showErrorAlert:(NSString *)message {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"AI Context Collector Error";
    alert.informativeText = message;
    alert.alertStyle = NSAlertStyleWarning;
    [alert addButtonWithTitle:@"OK"];
    [alert runModal];
}

@end
