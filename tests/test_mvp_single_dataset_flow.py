"""
MVP single dataset flow end-to-end test
"""
import os
import sys
import tempfile
from pathlib import Path
import pandas as pd
from datetime import datetime, timedelta
import pytest
import requests

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

API_BASE_URL = "http://localhost:8000"

def generate_test_data(days=60):
    """Generate test dataset with required fields"""
    dates = [datetime.now() - timedelta(days=days - i) for i in range(days)]
    
    data = {
        "date": [d.strftime("%Y-%m-%d") for d in dates],
        "purchase_power": [100 + i * 0.5 + (i % 7) * 2 for i in range(days)],
        "total_power": [300 + i * 0.8 + (i % 7) * 3 for i in range(days)],
        "self_power": [200 + i * 0.3 + (i % 7) * 1 for i in range(days)],
        "steel_output": [1000 + i * 2 + (i % 10) * 5 for i in range(days)],
        "rolling_output": [800 + i * 1.5 + (i % 10) * 4 for i in range(days)],
        "temperature": [20 + (i % 365) * 0.1 - 10 * (i // 180) for i in range(days)],
        "is_holiday": [1 if i % 7 == 0 else 0 for i in range(days)],
        "is_maintenance": [1 if i % 30 == 0 else 0 for i in range(days)]
    }
    
    df = pd.DataFrame(data)
    return df

def test_full_mvp_flow():
    """Test complete end-to-end MVP flow"""
    # Step 1: Generate test data
    test_df = generate_test_data(60)
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        test_df.to_csv(f, index=False)
        temp_file_path = f.name
    
    try:
        # Step 2: Upload dataset
        print("=== Step 1: Uploading test dataset ===")
        upload_url = f"{API_BASE_URL}/api/datasets/upload"
        
        with open(temp_file_path, 'rb') as f:
            files = {'file': ('test_data.csv', f, 'text/csv')}
            data = {'datasetType': 'training'}
            response = requests.post(upload_url, files=files, data=data)
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        dataset_info = response.json()
        dataset_id = dataset_info['datasetId']
        print(f"Uploaded dataset ID: {dataset_id}")
        
        # Step 3: Prepare dataset
        print("\n=== Step 2: Preparing dataset ===")
        prepare_url = f"{API_BASE_URL}/api/datasets/{dataset_id}/prepare"
        prepare_data = {"autoRepair": True, "activate": True}
        response = requests.post(prepare_url, json=prepare_data)
        
        assert response.status_code == 200, f"Prepare failed: {response.text}"
        prepare_result = response.json()
        assert prepare_result['success'] == True
        assert 'preparedFilePath' in prepare_result
        assert prepare_result['rowCount'] > 0
        print(f"Dataset prepared successfully, row count: {prepare_result['rowCount']}")
        
        # Step 4: Start training
        print("\n=== Step 3: Starting training job ===")
        train_url = f"{API_BASE_URL}/api/training/run"
        train_data = {
            "modelName": "purchase_power",
            "algorithm": "random_forest",
            "trainDataStart": (datetime.now() - timedelta(days=50)).strftime("%Y-%m-%d"),
            "trainDataEnd": datetime.now().strftime("%Y-%m-%d"),
            "remark": "MVP test training",
            "datasetId": dataset_id
        }
        
        response = requests.post(train_url, json=train_data)
        assert response.status_code == 200, f"Training failed: {response.text}"
        train_result = response.json()
        assert train_result['success'] == True
        assert 'modelVersion' in train_result
        model_version = train_result['modelVersion']
        print(f"Training completed successfully, model version: {model_version}")
        
        # Step 5: Check model list
        print("\n=== Step 4: Checking model list ===")
        models_url = f"{API_BASE_URL}/api/models"
        response = requests.get(models_url)
        assert response.status_code == 200, f"Get models failed: {response.text}"
        models = response.json()
        assert any(m['version'] == model_version for m in models), "Model not found in list"
        print(f"Model {model_version} found in model list")
        
        # Step 6: Promote model to production
        print("\n=== Step 5: Promoting model to production ===")
        promote_url = f"{API_BASE_URL}/api/models/{model_version}/promote"
        response = requests.post(promote_url)
        assert response.status_code == 200, f"Promote failed: {response.text}"
        promote_result = response.json()
        assert promote_result['success'] == True
        print(f"Model {model_version} promoted to production successfully")
        
        # Step 7: Run prediction with last_n mode
        print("\n=== Step 6: Running prediction with last_n mode ===")
        predict_url = f"{API_BASE_URL}/api/predictions/run"
        predict_data = {
            "mode": "last_n",
            "lastN": 7,
            "datasetId": dataset_id
        }
        response = requests.post(predict_url, json=predict_data)
        assert response.status_code == 200, f"Prediction failed: {response.text}"
        predict_result = response.json()
        assert predict_result['success'] == True
        assert predict_result['sampleCount'] == 7
        print(f"Prediction completed successfully, {predict_result['sampleCount']} samples predicted")
        
        # Step 8: Get prediction records
        print("\n=== Step 7: Checking prediction records ===")
        predictions_url = f"{API_BASE_URL}/api/predictions"
        response = requests.get(predictions_url)
        assert response.status_code == 200, f"Get predictions failed: {response.text}"
        predictions = response.json()
        assert len(predictions) >= 7, "Prediction records not found"
        print(f"Found {len(predictions)} prediction records")
        
        print("\n✅ All MVP flow tests passed successfully!")
        
    finally:
        # Clean up temp file
        os.unlink(temp_file_path)

if __name__ == "__main__":
    test_full_mvp_flow()
