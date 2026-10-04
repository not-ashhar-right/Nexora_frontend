import { useEffect, useMemo, useState } from "react";

import {
  createSupplierOrder,
  getAdminProcurement,
  getSupplierOffers,
} from "../../services/adminService";

import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import SearchInput from "../../components/common/SearchInput";
import Select from "../../components/common/Select";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";

import "./AdminProcurement.css";

function getArray(data) {
  if (Array.isArray(data)) return data;

  return (
    data?.items ||
    data?.requests ||
    data?.procurement ||
    data?.data ||
    []
  );
}

function getId(item) {
  return (
    item?.id ||
    item?._id ||
    item?.requestId ||
    item?.procurementId
  );
}

function getStatus(item) {
  return String(
    item?.status ||
      item?.requestStatus ||
      "pending"
  ).toLowerCase();
}

function getStatusVariant(status) {
  const normalized = status.replace(/[_-]/g, " ");

  if (
    [
      "completed",
      "delivered",
      "accepted",
      "approved",
      "ordered",
    ].includes(normalized)
  ) {
    return "success";
  }

  if (
    [
      "rejected",
      "cancelled",
      "canceled",
      "failed",
    ].includes(normalized)
  ) {
    return "danger";
  }

  if (
    [
      "processing",
      "preparing",
      "shipped",
      "in transit",
    ].includes(normalized)
  ) {
    return "info";
  }

  return "warning";
}



function formatCurrency(value) {
  const amount = Number(value);

  if (Number.isNaN(amount)) return "—";

  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

/*
 * Temporary frontend demo offers.
 *
 * The backend will eventually provide these supplier offers.
 * Keeping them here lets us fully test the admin workflow
 * before the backend exists.
 */


function AdminProcurement() {
  const [requests, setRequests] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedRequest, setSelectedRequest] = useState(null);
 const [selectedSupplier, setSelectedSupplier] = useState(null);
const [supplierOffers, setSupplierOffers] = useState([]);
const [isLoadingOffers, setIsLoadingOffers] = useState(false);
const [orderQuantity, setOrderQuantity] = useState(0);

  const [orderCreated, setOrderCreated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProcurement = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await getAdminProcurement();

        setRequests(getArray(response));
      } catch (requestError) {
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.error ||
            requestError?.message ||
            "Unable to load procurement requests."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadProcurement();
  }, []);

useEffect(() => {
  if (!selectedRequest) {
    return;
  }

  const loadSupplierOffers = async () => {
    setIsLoadingOffers(true);

    try {
      const productName =
        selectedRequest?.productName ||
        selectedRequest?.product?.name;

      const offers = await getSupplierOffers(productName);

      setSupplierOffers(
        Array.isArray(offers)
          ? offers
          : offers?.data || offers?.items || []
      );
    } catch {
      setSupplierOffers([]);
    } finally {
      setIsLoadingOffers(false);
    }
  };

  loadSupplierOffers();
}, [selectedRequest]);
  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const status = getStatus(request);

      if (
        statusFilter !== "all" &&
        status !== statusFilter
      ) {
        return false;
      }

      if (!query) return true;

      return [
        getId(request),
        request?.productName,
        request?.product?.name,
        request?.merchantName,
        request?.merchant?.name,
        request?.supplierName,
        request?.supplier?.name,
        request?.sku,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        );
    });
  }, [requests, search, statusFilter]);

  

  const totalOrderValue =
    Number(orderQuantity || 0) *
    Number(selectedSupplier?.price || 0);

  const openProcurementControl = (request) => {
    setSelectedRequest(request);
    setSelectedSupplier(null);
    setOrderCreated(false);

    const quantity =
      Number(
        request?.quantity ??
          request?.requestedQuantity ??
          1
      ) || 1;

    setOrderQuantity(quantity);
  };

  const closeProcurementControl = () => {
    setSelectedRequest(null);
    setSelectedSupplier(null);
    setOrderQuantity(0);
    setOrderCreated(false);
  };

  const handleSupplierSelect = (supplier) => {
    setSelectedSupplier(supplier);

    const requestedQuantity =
      Number(
        selectedRequest?.quantity ??
          selectedRequest?.requestedQuantity ??
          1
      ) || 1;

    const minimumQuantity =
      Number(supplier.minimumOrderQuantity || 1);

    setOrderQuantity(
      Math.max(requestedQuantity, minimumQuantity)
    );
  };

  const handleCreateSupplierOrder = async () => {
  if (!selectedRequest || !selectedSupplier) {
    return;
  }

  if (
    orderQuantity < selectedSupplier.minimumOrderQuantity
  ) {
    return;
  }

  if (
    orderQuantity > selectedSupplier.availableStock
  ) {
    return;
  }

  try {
    await createSupplierOrder({
      requestId: getId(selectedRequest),

      productId:
        selectedRequest?.productId ||
        selectedRequest?.product?.id,

      productName:
        selectedRequest?.productName ||
        selectedRequest?.product?.name,

      supplierId: selectedSupplier.supplierId || selectedSupplier.id,

      supplierName:
        selectedSupplier.supplierName,

      quantity: orderQuantity,

      unitPrice: selectedSupplier.price,

      totalAmount: totalOrderValue,
    });

    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        getId(request) === getId(selectedRequest)
          ? {
              ...request,
              status: "ordered",
              supplierName:
                selectedSupplier.supplierName,
              supplier: {
                name:
                  selectedSupplier.supplierName,
              },
              orderedQuantity: orderQuantity,
              totalAmount: totalOrderValue,
            }
          : request
      )
    );

    setOrderCreated(true);
  } catch {
    setError(
      "Unable to create the supplier order. Please try again."
    );
  }
};

  const getMerchantName = (request) =>
    request?.merchantName ||
    request?.merchant?.name ||
    "Demo Merchant";

  return (
    <div className="admin-procurement">
      <div className="page-header">
        <div>
          <h1>Procurement</h1>

          <p>
            Review merchant demand, compare suppliers
            and create supplier orders.
          </p>
        </div>
      </div>

      {error && (
        <div className="admin-procurement-error">
          {error}
        </div>
      )}

      <Card padding="medium">
        <div className="admin-procurement-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search products, merchants or suppliers..."
          />

          <Select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            options={[
              {
                value: "all",
                label: "All statuses",
              },
              {
                value: "pending",
                label: "Pending",
              },
              {
                value: "ordered",
                label: "Ordered",
              },
              {
                value: "accepted",
                label: "Accepted",
              },
              {
                value: "processing",
                label: "Processing",
              },
              {
                value: "preparing",
                label: "Preparing",
              },
              {
                value: "completed",
                label: "Completed",
              },
              {
                value: "rejected",
                label: "Rejected",
              },
              {
                value: "cancelled",
                label: "Cancelled",
              },
            ]}
          />
        </div>
      </Card>

      <Card padding="none">
        {isLoading ? (
          <div className="admin-procurement-loading">
            <Spinner size="large" />

            <p>
              Loading procurement requests...
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title={
              search || statusFilter !== "all"
                ? "No matching requests"
                : "No procurement requests"
            }
            description={
              search || statusFilter !== "all"
                ? "Try changing your search or status filter."
                : "Merchant procurement requests will appear here."
            }
          />
        ) : (
          <div className="admin-procurement-table-wrapper">
            <table className="admin-procurement-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Merchant</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Commitment</th>
                  <th>Supplier</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map(
                  (request, index) => {
                    const id = getId(request);

                    const product =
                      request?.productName ||
                      request?.product?.name ||
                      "—";

                    const quantity =
                      request?.quantity ??
                      request?.requestedQuantity ??
                      "—";

                    const commitment =
                      request?.commitmentPercentage ??
                      request?.commitment ??
                      10;

                    const supplier =
                      request?.supplierName ||
                      request?.supplier?.name ||
                      "Not assigned";

                    const value =
                      request?.totalAmount ??
                      request?.total ??
                      request?.amount ??
                      Number(
                        request?.price ??
                          request?.unitPrice ??
                          0
                      ) * Number(quantity || 0);

                    const status = getStatus(request);

                    return (
                      <tr
                        key={
                          id ||
                          `request-${index}`
                        }
                      >
                        <td>
                          <strong>
                            {id
                              ? `#${id}`
                              : "—"}
                          </strong>
                        </td>

                        <td>
                          {getMerchantName(request)}
                        </td>

                        <td>
                          <div className="admin-procurement-product">
                            <strong>
                              {product}
                            </strong>

                            {request?.sku && (
                              <span>
                                SKU:{" "}
                                {request.sku}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>{quantity}</td>

                        <td>
                          {commitment}%
                        </td>

                        <td>{supplier}</td>

                        <td>
                          {formatCurrency(value)}
                        </td>

                        <td>
                          <Badge
                            size="small"
                            variant={getStatusVariant(
                              status
                            )}
                          >
                            {status}
                          </Badge>
                        </td>

                        <td>
                          {[
                            "pending",
                            "approved",
                            "accepted",
                          ].includes(status) ? (
                            <Button
                              size="small"
                              onClick={() =>
                                openProcurementControl(
                                  request
                                )
                              }
                            >
                              Manage
                            </Button>
                          ) : (
                            <span className="admin-procurement-action-muted">
                              {status === "ordered"
                                ? "Order created"
                                : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedRequest && (
        <Card padding="large">
          <div className="procurement-control-header">
            <div>
              <span className="procurement-control-eyebrow">
                Procurement control
              </span>

              <h2>
                Select supplier
              </h2>

              <p>
                Compare available suppliers before
                creating the platform order.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={closeProcurementControl}
            >
              Close
            </Button>
          </div>

          <div className="procurement-request-summary">
            <div>
              <span>Request</span>
              <strong>
                #{getId(selectedRequest)}
              </strong>
            </div>

            <div>
              <span>Merchant</span>
              <strong>
                {getMerchantName(
                  selectedRequest
                )}
              </strong>
            </div>

            <div>
              <span>Product</span>
              <strong>
                {selectedRequest?.productName ||
                  selectedRequest?.product?.name ||
                  "—"}
              </strong>
            </div>

            <div>
              <span>Requested quantity</span>
              <strong>
                {selectedRequest?.quantity ??
                  selectedRequest?.requestedQuantity ??
                  "—"}
              </strong>
            </div>
          </div>

          {isLoadingOffers ? (
  <div className="admin-procurement-loading">
    <Spinner size="large" />

    <p>
      Loading supplier offers...
    </p>
  </div>
) : supplierOffers.length === 0 ? (
            <EmptyState
              title="No supplier offers"
              description="There are currently no supplier offers available for this product."
            />
          ) : (
            <>
              <div className="supplier-comparison">
                {supplierOffers.map(
                  (supplier) => {
                    const isSelected =
                      selectedSupplier?.id ===
                      supplier.id;

                    return (
                      <div
                        key={supplier.id}
                        className={`supplier-offer ${
                          isSelected
                            ? "supplier-offer-selected"
                            : ""
                        }`}
                      >
                        <div className="supplier-offer-top">
                          <div>
                            <h3>
                              {
                                supplier.supplierName
                              }
                            </h3>

                            <span>
                              ★{" "}
                              {supplier.rating}
                            </span>
                          </div>

                          <strong>
                            {formatCurrency(
                              supplier.price
                            )}
                            <small>
                              / unit
                            </small>
                          </strong>
                        </div>

                        <div className="supplier-offer-details">
                          <div>
                            <span>
                              Available
                            </span>
                            <strong>
                              {
                                supplier.availableStock
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              Minimum order
                            </span>
                            <strong>
                              {
                                supplier.minimumOrderQuantity
                              }
                            </strong>
                          </div>

                          <div>
                            <span>
                              Delivery
                            </span>
                            <strong>
                              {
                                supplier.deliveryDays
                              }{" "}
                              days
                            </strong>
                          </div>
                        </div>

                        <Button
                          fullWidth
                          variant={
                            isSelected
                              ? "primary"
                              : "secondary"
                          }
                          onClick={() =>
                            handleSupplierSelect(
                              supplier
                            )
                          }
                        >
                          {isSelected
                            ? "Supplier Selected"
                            : "Select Supplier"}
                        </Button>
                      </div>
                    );
                  }
                )}
              </div>

              {selectedSupplier && (
                <div className="supplier-order-panel">
                  <div>
                    <span className="supplier-order-label">
                      Selected supplier
                    </span>

                    <strong>
                      {
                        selectedSupplier.supplierName
                      }
                    </strong>
                  </div>

                  <div className="supplier-order-field">
                    <label htmlFor="order-quantity">
                      Order quantity
                    </label>

                    <input
                      id="order-quantity"
                      type="number"
                      min={
                        selectedSupplier.minimumOrderQuantity
                      }
                      max={
                        selectedSupplier.availableStock
                      }
                      value={orderQuantity}
                      onChange={(event) =>
                        setOrderQuantity(
                          Number(
                            event.target.value
                          )
                        )
                      }
                    />

                    <small>
                      MOQ:{" "}
                      {
                        selectedSupplier.minimumOrderQuantity
                      }{" "}
                      · Available:{" "}
                      {
                        selectedSupplier.availableStock
                      }
                    </small>
                  </div>

                  <div className="supplier-order-total">
                    <span>Order value</span>

                    <strong>
                      {formatCurrency(
                        totalOrderValue
                      )}
                    </strong>
                  </div>

                  <Button
                    size="large"
                    disabled={
                      orderQuantity <
                        selectedSupplier.minimumOrderQuantity ||
                      orderQuantity >
                        selectedSupplier.availableStock ||
                      orderCreated
                    }
                    onClick={
                      handleCreateSupplierOrder
                    }
                  >
                    {orderCreated
                      ? "Supplier Order Created"
                      : "Create Supplier Order"}
                  </Button>
                </div>
              )}

              {orderCreated && (
                <div
                  className="supplier-order-success"
                  role="status"
                >
                  <strong>
                    Supplier order created successfully.
                  </strong>

                  <span>
                    The order has been routed to{" "}
                    {
                      selectedSupplier.supplierName
                    }{" "}
                    for fulfilment.
                  </span>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default AdminProcurement;