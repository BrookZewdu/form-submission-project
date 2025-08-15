const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:3001';

async function testFormSubmissionAPI() {
  console.log('🧪 Testing Form Submission API...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.service);

    // Test 2: Get users (should be empty initially)
    console.log('\n2. Testing get users...');
    const usersResponse = await axios.get(`${BACKEND_URL}/api/users`);
    console.log('✅ Get users passed:', `Found ${usersResponse.data.count} users`);

    // Test 3: Create a test image (if none exists)
    const testImagePath = path.join(__dirname, 'test-image.png');
    if (!fs.existsSync(testImagePath)) {
      console.log('\n3. Creating test image...');
      // Create a simple test image (1x1 PNG)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8E, 0x5E, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(testImagePath, pngData);
      console.log('✅ Test image created');
    }

    // Test 4: Submit form
    console.log('\n4. Testing form submission...');
    const formData = new FormData();
    formData.append('first_name', 'John');
    formData.append('last_name', 'Doe');
    formData.append('image', fs.createReadStream(testImagePath));

    const submitResponse = await axios.post(`${BACKEND_URL}/api/submit`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    console.log('✅ Form submission passed:', submitResponse.data.data.full_name);

    // Test 5: Get users again (should have 1 user now)
    console.log('\n5. Testing get users after submission...');
    const usersAfterResponse = await axios.get(`${BACKEND_URL}/api/users`);
    console.log('✅ Get users after submission:', `Found ${usersAfterResponse.data.count} users`);
    
    // Display the user data
    if (usersAfterResponse.data.data.length > 0) {
      const user = usersAfterResponse.data.data[0];
      console.log('   📋 User data:', {
        id: user.id,
        full_name: user.full_name,
        image_url: user.image_url
      });
    }

    // Test 6: Get specific user
    if (usersAfterResponse.data.data.length > 0) {
      const userId = usersAfterResponse.data.data[0].id;
      console.log('\n6. Testing get specific user...');
      const userResponse = await axios.get(`${BACKEND_URL}/api/users/${userId}`);
      console.log('✅ Get specific user passed:', userResponse.data.data.full_name);
    }

    console.log('\n🎉 All tests passed! Your Form Submission API is working correctly.');
    console.log('\n📋 Next steps:');
    console.log('   1. Start your React app: cd react-app && npm start');
    console.log('   2. Open http://localhost:3000 to use the form');
    console.log('   3. Test form submission through the UI');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure your backend is running:');
      console.log('   cd backend && npm run dev');
    }
  }
}

// Test form validation errors
async function testValidation() {
  console.log('\n🧪 Testing Form Validation...\n');

  try {
    // Test missing fields
    console.log('1. Testing missing first name...');
    const formData1 = new FormData();
    formData1.append('last_name', 'Doe');
    
    const response1 = await axios.post(`${BACKEND_URL}/api/submit`, formData1);
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Validation works:', error.response.data.error);
    }
  }

  try {
    // Test missing image
    console.log('\n2. Testing missing image...');
    const formData2 = new FormData();
    formData2.append('first_name', 'John');
    formData2.append('last_name', 'Doe');
    
    const response2 = await axios.post(`${BACKEND_URL}/api/submit`, formData2);
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Image validation works:', error.response.data.error);
    }
  }

  console.log('\n✅ Validation tests completed!');
}

// Run tests
async function runAllTests() {
  await testFormSubmissionAPI();
  await testValidation();
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--validation')) {
    testValidation().catch(console.error);
  } else {
    runAllTests().catch(console.error);
  }
}

module.exports = { testFormSubmissionAPI, testValidation };