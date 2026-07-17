rules_version = '2';
service cloud.firestore {
match /databases/{database}/documents {

    // ===== Helper Functions =====
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() && request.auth.token.admin == true;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // ===== Users Collection =====
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create, update: if isOwner(userId);
      allow write: if isAdmin();
    }

    // ===== Courses Collection ===== ✅ FIXED - Uncommented and updated
    match /courses/{courseId} {
      // Anyone can read published courses
      allow read: if resource.data.status == 'published'
                  || isOwner(resource.data.instructorId)
                  || isAdmin();

      // Anyone authenticated can create a course (with their own instructorId)
      allow create: if isAuthenticated()
                    && request.resource.data.instructorId == request.auth.uid;

      // Only instructor or admin can update their own course
      allow update: if isAuthenticated()
                    && (resource.data.instructorId == request.auth.uid || isAdmin());

      // Only instructor or admin can delete
      allow delete: if isAuthenticated()
                    && (resource.data.instructorId == request.auth.uid || isAdmin());
    }

    // ===== Deleted Courses Collection ===== ✅ NEW - Added rules
    match /deletedCourses/{courseId} {
      // Only instructor or admin can read deleted courses
      allow read: if isAuthenticated()
                  && (resource.data.instructorId == request.auth.uid || isAdmin());

      // Only instructor or admin can move to deleted
      allow create: if isAuthenticated()
                    && (request.resource.data.instructorId == request.auth.uid || isAdmin());

      // Only admin can restore or permanently delete
      allow update, delete: if isAdmin();
    }

    // ===== Enrollments Collection =====
    match /enrollments/{enrollmentId} {
      // Users can only read their own enrollments
      allow read: if isAuthenticated()
                  && enrollmentId.matches('^' + request.auth.uid + '_.*');

      // Admins can read all enrollments
      allow read: if isAdmin();

      // ❌ NO client writes - only API creates/updates enrollments
      allow write: if false;
    }

    // ===== Favorites Collection =====
    match /favorites/{favoriteId} {
      // Users can read their own favorites
      allow read: if isAuthenticated()
                  && favoriteId.matches('^' + request.auth.uid + '_.*');

      // Users can create their own favorites
      allow create: if isAuthenticated()
                    && request.resource.data.userId == request.auth.uid
                    && favoriteId == request.auth.uid + '_' + request.resource.data.courseId;

      // Users can delete their own favorites
      allow delete: if isAuthenticated()
                    && resource.data.userId == request.auth.uid;

      // Admins can read all favorites
      allow read: if isAdmin();
    }

    // ===== Wallets Collection =====
    match /wallets/{userId} {
      allow read: if isOwner(userId);
      allow write: if isAdmin();
    }

    // ===== Topup Requests =====
    match /topup_requests/{requestId} {
      // Users can read their own requests
      allow read: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;

      // Admins can read all requests
      allow read: if isAdmin();

      // Users can create their own requests
      allow create: if isAuthenticated()
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.status == "pending";

      // Only admins can update/delete requests
      allow update, delete: if isAdmin();
    }

    // ===== Wallet Transactions =====
    match /wallet_transactions/{transactionId} {
      allow read: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;
      allow read: if isAdmin();
      allow write: if false;
    }

    // ===== Payment Transactions =====
    match /payment_transactions/{transactionId} {
      allow read: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;
      allow read: if isAdmin();
      allow write: if false;
    }

    // ===== System Events =====
    match /system_events/{eventId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }

    // ===== Deny Everything Else =====
    match /{document=**} {
      allow read, write: if false;
    }

}
}
